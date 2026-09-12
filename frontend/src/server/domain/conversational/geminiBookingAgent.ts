import { randomUUID } from 'crypto';
import { AvailabilityService } from '../booking/availabilityService';
import { AppointmentRepository } from '../../db/repositories';
import {
  GeminiClient,
  GeminiContent,
  GeminiFunctionDeclaration,
  GeminiPart,
} from '../../integrations/gemini/geminiClient';

// =============================================================================
// TURBOBOOKING - GEMINI BOOKING AGENT (ORCHESTRATORE WHATSAPP, §1.1 / §4.1.1)
// Il modello decide se rispondere o chiamare una funzione; il backend esegue la
// chiamata reale verso Turbo Booking e restituisce l'esito al modello.
// =============================================================================

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TOOL_ROUNDS = 6;
const DEFAULT_DURATION_MINUTES = 45;

export type BookingToolName =
  | 'controlla_disponibilita'
  | 'crea_evento'
  | 'modifica_prenotazione'
  | 'cancella_prenotazione';

interface AgentSession {
  contents: GeminiContent[];
  lastInteraction: number;
}

const sessions = new Map<string, AgentSession>();

const TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: 'controlla_disponibilita',
    description: 'Restituisce gli slot liberi per una data, opzionalmente per servizio e operatore.',
    parameters: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'Data richiesta in formato YYYY-MM-DD' },
        servizio_id: { type: 'string', description: 'ID del servizio, se noto' },
        staff_id: { type: 'string', description: "ID dell'operatore preferito, se indicato dal cliente" },
      },
      required: ['data'],
    },
  },
  {
    name: 'crea_evento',
    description: 'Crea e conferma un appuntamento sul calendario. Usare solo dopo che il cliente ha scelto uno slot restituito da controlla_disponibilita.',
    parameters: {
      type: 'object',
      properties: {
        servizio_id: { type: 'string', description: 'ID del servizio' },
        staff_id: { type: 'string', description: "ID dell'operatore dello slot scelto" },
        data: { type: 'string', description: 'Data in formato YYYY-MM-DD' },
        ora_inizio: { type: 'string', description: 'Orario di inizio in formato HH:MM' },
      },
      required: ['servizio_id', 'staff_id', 'data', 'ora_inizio'],
    },
  },
  {
    name: 'modifica_prenotazione',
    description: 'Sposta un appuntamento esistente del cliente su una nuova data/ora.',
    parameters: {
      type: 'object',
      properties: {
        appointment_id: { type: 'string', description: "ID dell'appuntamento da spostare" },
        nuova_data: { type: 'string', description: 'Nuova data in formato YYYY-MM-DD' },
        nuova_ora_inizio: { type: 'string', description: 'Nuovo orario di inizio in formato HH:MM' },
        nuovo_staff_id: { type: 'string', description: 'Nuovo operatore, se cambia' },
      },
      required: ['appointment_id', 'nuova_data', 'nuova_ora_inizio'],
    },
  },
  {
    name: 'cancella_prenotazione',
    description: 'Cancella un appuntamento esistente del cliente.',
    parameters: {
      type: 'object',
      properties: {
        appointment_id: { type: 'string', description: "ID dell'appuntamento da cancellare" },
      },
      required: ['appointment_id'],
    },
  },
];

function buildSystemInstruction(senderName?: string): string {
  const today = new Date().toISOString().split('T')[0];
  return [
    "Sei l'assistente WhatsApp del salone Gianluca Parrucchieri di Forlì. Rispondi sempre in italiano, in modo breve e cordiale.",
    `Oggi è ${today}.${senderName ? ` Il cliente si chiama ${senderName}.` : ''}`,
    'Per disponibilità e prenotazioni usa SEMPRE le funzioni: non inventare orari, operatori o ID.',
    'Prima di crea_evento proponi gli slot restituiti da controlla_disponibilita e attendi la scelta del cliente.',
    "Se il cliente invia una foto (es. un taglio di riferimento), descrivila brevemente e usala per capire il servizio richiesto; non promettere risultati.",
    "Per richieste che non puoi gestire (reclami, prezzi personalizzati, urgenze) rispondi che un operatore del salone lo ricontatterà.",
  ].join('\n');
}

function toIso(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000).toISOString();
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  customerId: string
): Promise<Record<string, unknown>> {
  switch (name as BookingToolName) {
    case 'controlla_disponibilita': {
      const slots = await AvailabilityService.findAvailableSlots({
        targetDate: String(args.data),
        serviceId: args.servizio_id ? String(args.servizio_id) : undefined,
        preferredStaffId: args.staff_id ? String(args.staff_id) : undefined,
      });
      return { slots };
    }

    case 'crea_evento': {
      const startsAt = toIso(String(args.data), String(args.ora_inizio));
      const hold = await AvailabilityService.reserveHold({
        customerId,
        staffId: String(args.staff_id),
        serviceId: String(args.servizio_id),
        startsAt,
        endsAt: addMinutes(startsAt, DEFAULT_DURATION_MINUTES),
        idempotencyKey: randomUUID(),
      });
      if (!hold.success || !hold.hold) {
        return { success: false, motivo: hold.conflictReason || 'Slot non più disponibile' };
      }
      const confirmed = await AvailabilityService.confirmHold(hold.hold.id);
      return confirmed.success
        ? { success: true, appointment: confirmed.appointment }
        : { success: false, motivo: 'Conferma non riuscita' };
    }

    case 'modifica_prenotazione': {
      const appointmentId = String(args.appointment_id);
      const existing = await AppointmentRepository.findHold(appointmentId);
      if (!existing || existing.customer_id !== customerId) {
        return { success: false, motivo: 'Appuntamento non trovato per questo cliente' };
      }
      const startsAt = toIso(String(args.nuova_data), String(args.nuova_ora_inizio));
      const durationMin =
        (new Date(existing.ends_at).getTime() - new Date(existing.starts_at).getTime()) / 60000 ||
        DEFAULT_DURATION_MINUTES;
      return AvailabilityService.rescheduleAppointment({
        appointmentId,
        startsAt,
        endsAt: addMinutes(startsAt, durationMin),
        staffId: args.nuovo_staff_id ? String(args.nuovo_staff_id) : undefined,
      });
    }

    case 'cancella_prenotazione': {
      const appointmentId = String(args.appointment_id);
      const existing = await AppointmentRepository.findHold(appointmentId);
      if (!existing || existing.customer_id !== customerId) {
        return { success: false, motivo: 'Appuntamento non trovato per questo cliente' };
      }
      return AvailabilityService.cancelAppointment(appointmentId);
    }

    default:
      return { success: false, motivo: `Funzione sconosciuta: ${name}` };
  }
}

export const GeminiBookingAgent = {
  async reply({
    customerId,
    phone,
    senderName,
    text,
    imageBase64,
    imageMimeType,
  }: {
    customerId: string;
    phone: string;
    senderName?: string;
    text: string;
    imageBase64?: string;
    imageMimeType?: string;
  }): Promise<{ replyText: string; toolsCalled: BookingToolName[] }> {
    const now = Date.now();
    const existing = sessions.get(phone);
    const session: AgentSession =
      existing && now - existing.lastInteraction < SESSION_TTL_MS
        ? existing
        : { contents: [], lastInteraction: now };
    session.lastInteraction = now;
    sessions.set(phone, session);

    const userParts: GeminiPart[] = [];
    if (imageBase64 && imageMimeType) {
      userParts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
    }
    userParts.push({ text: text || '(il cliente ha inviato solo una foto)' });
    session.contents.push({ role: 'user', parts: userParts });

    const systemInstruction = buildSystemInstruction(senderName);
    const toolsCalled: BookingToolName[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await GeminiClient.generate({
        systemInstruction,
        contents: session.contents,
        tools: TOOLS,
      });

      if (result.refusal) {
        const refusalText = 'Su questo non posso aiutarti, ma un operatore del salone ti risponderà al più presto.';
        session.contents.push({ role: 'model', parts: [{ text: refusalText }] });
        return { replyText: refusalText, toolsCalled };
      }

      if (!result.functionCall) {
        const replyText = result.text || 'Scusa, non ho capito. Puoi ripetere?';
        session.contents.push({ role: 'model', parts: [{ text: replyText }] });
        return { replyText, toolsCalled };
      }

      const { name, args } = result.functionCall;
      session.contents.push({ role: 'model', parts: [{ functionCall: { name, args } }] });
      toolsCalled.push(name as BookingToolName);

      const toolResult = await runTool(name, args || {}, customerId);
      session.contents.push({
        role: 'user',
        parts: [{ functionResponse: { name, response: toolResult } }],
      });
    }

    const fallbackText = 'Ti faccio ricontattare da un operatore del salone per completare la richiesta.';
    session.contents.push({ role: 'model', parts: [{ text: fallbackText }] });
    return { replyText: fallbackText, toolsCalled };
  },
};
