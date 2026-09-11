import Anthropic from '@anthropic-ai/sdk';
import { mockServices, mockVenues } from '@/data/mockData';
import { WhatsAppBookingStore } from '../booking/whatsappBookingStore';

// =============================================================================
// TURBOBOOKING - AGENTE WHATSAPP IN LINGUAGGIO NATURALE (CLAUDE + TOOL USE)
// Il cliente scrive liberamente ("domani pomeriggio un taglio da Gianluca"),
// Claude interpreta, verifica disponibilità reale e crea l'appuntamento.
// =============================================================================

const MODEL = 'claude-opus-5';
const MAX_TOOL_ROUNDS = 6;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const client = new Anthropic();

interface Conversation {
  messages: Anthropic.Beta.BetaMessageParam[];
  lastInteraction: number;
}
const conversations = new Map<string, Conversation>();

const venue = mockVenues[0];
const staffCatalog = WhatsAppBookingStore.bookableStaff()
  .map((s) => `- ${s.id}: ${s.name} ${s.surname} (${s.role})`)
  .join('\n');
const serviceCatalog = mockServices
  .map((s) => `- ${s.id}: ${s.name} [${s.category}] ${s.durationMinutes} min, €${s.price}`)
  .join('\n');

const SYSTEM_PROMPT = `Sei l'assistente WhatsApp del salone "${venue.name}" (${venue.address}, ${venue.zipCity}).
Aiuti i clienti a prenotare, spostare o disdire appuntamenti scrivendo in italiano naturale, con tono cordiale e messaggi brevi adatti a WhatsApp (niente markdown, al massimo qualche emoji).

Per prenotare ti servono: servizio, giorno, orario e nome del cliente. Il collaboratore è facoltativo: se il cliente non lo indica, proponi chi è libero.
- Deduci il servizio dal catalogo; se la richiesta è ambigua (es. "taglio" per uomo o donna) chiedi una sola domanda di chiarimento.
- Converti espressioni come "domani", "sabato prossimo", "nel pomeriggio" in date e fasce orarie concrete.
- Usa sempre check_availability prima di proporre orari: non inventare mai disponibilità. Proponi al massimo 3 orari.
- Chiama create_booking solo dopo che il cliente ha confermato esplicitamente orario e servizio.
- Dopo la prenotazione riepiloga servizio, collaboratore, giorno e ora.
- Per disdire usa list_my_bookings e poi cancel_booking dopo conferma.
- Se il cliente chiede qualcosa che non puoi gestire (prezzi particolari, reclami, informazioni mediche), digli che lo ricontatterà il salone.

Collaboratori prenotabili:
${staffCatalog}

Catalogo servizi (id: nome [categoria] durata, prezzo):
${serviceCatalog}`;

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'check_availability',
    description:
      'Restituisce gli orari liberi per un servizio in un giorno, per ogni collaboratore (o solo per quello indicato).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string', description: 'Id del servizio dal catalogo, es. srv-5' },
        date: { type: 'string', description: 'Data in formato YYYY-MM-DD' },
        staff_id: { type: ['string', 'null'], description: 'Id collaboratore, oppure null per tutti' },
      },
      required: ['service_id', 'date', 'staff_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_booking',
    description: "Crea l'appuntamento nel calendario del salone. Usare solo dopo conferma esplicita del cliente.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        service_id: { type: 'string' },
        staff_id: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        start_time: { type: 'string', description: 'HH:MM' },
        client_name: { type: 'string', description: 'Nome e cognome del cliente' },
        notes: { type: ['string', 'null'], description: 'Eventuali richieste del cliente' },
      },
      required: ['service_id', 'staff_id', 'date', 'start_time', 'client_name', 'notes'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_my_bookings',
    description: 'Elenca gli appuntamenti attivi del cliente che sta scrivendo.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'cancel_booking',
    description: 'Disdice un appuntamento del cliente. Usare solo dopo conferma esplicita.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { appointment_id: { type: 'string' } },
      required: ['appointment_id'],
      additionalProperties: false,
    },
  },
];

function runTool(name: string, input: Record<string, unknown>, phone: string): unknown {
  switch (name) {
    case 'check_availability':
      return WhatsAppBookingStore.findFreeSlots({
        serviceId: String(input.service_id),
        date: String(input.date),
        staffId: (input.staff_id as string | null) ?? undefined,
      });
    case 'create_booking':
      return WhatsAppBookingStore.createBooking({
        serviceId: String(input.service_id),
        staffId: String(input.staff_id),
        date: String(input.date),
        startTime: String(input.start_time),
        clientName: String(input.client_name),
        clientPhone: phone,
        notes: (input.notes as string | null) ?? undefined,
      });
    case 'list_my_bookings':
      return WhatsAppBookingStore.listForPhone(phone).map((a) => ({
        appointment_id: a.id,
        service: a.serviceName,
        staff: a.staffName,
        date: a.date,
        start_time: a.startTime,
      }));
    case 'cancel_booking':
      return { success: WhatsAppBookingStore.cancelBooking(String(input.appointment_id), phone) };
    default:
      return { error: `Tool sconosciuto: ${name}` };
  }
}

function todayContext(): string {
  const now = new Date();
  const formatted = now.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  });
  const time = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  return `Oggi è ${formatted}, ore ${time}.`;
}

export const ClaudeBookingAgent = {
  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  },

  /** Elabora un messaggio WhatsApp e restituisce il testo di risposta */
  async reply({ phone, senderName, text }: { phone: string; senderName?: string; text: string }): Promise<string> {
    const existing = conversations.get(phone);
    const conversation =
      existing && Date.now() - existing.lastInteraction < SESSION_TTL_MS
        ? existing
        : { messages: [], lastInteraction: Date.now() };
    conversation.lastInteraction = Date.now();
    conversations.set(phone, conversation);

    const header = senderName ? `[Nome profilo WhatsApp: ${senderName}]\n` : '';
    conversation.messages.push({ role: 'user', content: conversation.messages.length ? text : header + text });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: todayContext() },
        ],
        tools,
        messages: conversation.messages,
      });

      conversation.messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'refusal') {
        return 'Mi dispiace, non posso aiutarti con questa richiesta. Ti ricontatterà il salone.';
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use'
      );
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
        return response.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
      }

      conversation.messages.push({
        role: 'user',
        content: toolUses.map((tu) => ({
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: JSON.stringify(runTool(tu.name, tu.input as Record<string, unknown>, phone)),
        })),
      });
    }

    return 'Scusa, sto avendo qualche difficoltà. Ti ricontatterà a breve il salone.';
  },
};
