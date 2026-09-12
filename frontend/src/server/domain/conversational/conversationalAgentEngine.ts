import { randomUUID } from 'crypto';
import { CustomerRepository, ExternalRefsRepository } from '../../db/repositories';
import { CustomerRow } from '../../db/supabaseClient';
import { AvailabilityService, TimeSlot } from '../booking/availabilityService';
import {
  InboundMessageEvent,
  ConversationalAgentResult,
  ConversationIntent,
} from './conversationalTypes';
import { MetaSender } from '../../integrations/meta/metaSender';
import { GoHighLevelChannel } from '../../integrations/ghl/ghlNotificationChannel';
import { GeminiBookingAgent } from './geminiBookingAgent';

// =============================================================================
// TURBOBOOKING - CONVERSATIONAL AGENT ENGINE ("UNA SOLA LOGICA")
// Unico motore di logica condiviso tra Meta (WhatsApp/IG/FB), GHL e BetterCallQ.
// Rispetta i vincoli di non-overbooking, latenza e riservatezza GDPR (§04, §01).
// =============================================================================

// Stato conversazione in memoria (TTL breve per continuità del dialogo multi-turno)
interface DialogSession {
  lastHoldId?: string;
  proposedSlots?: TimeSlot[];
  pendingService?: string;
  turnCount: number;
  lastInteraction: number;
}
const dialogSessions = new Map<string, DialogSession>();

export const ConversationalAgentEngine = {
  /**
   * Elabora un messaggio in ingresso e genera la risposta unificata
   */
  async processInboundMessage(event: InboundMessageEvent): Promise<ConversationalAgentResult> {
    const rawText = event.text.trim();
    const lower = rawText.toLowerCase();

    // 1. Risoluzione o identificazione cliente su Supabase (E.164 phone)
    let customer: CustomerRow | null = null;

    if (event.senderPhoneE164) {
      customer = await CustomerRepository.findByPhone(event.senderPhoneE164);
      if (!customer) {
        // Creazione anagrafica contatto automatica al primo messaggio spontaneo (§04.2)
        const nameParts = (event.senderName || 'Cliente').split(' ');
        customer = await CustomerRepository.upsertFromExternal({
          phoneE164: event.senderPhoneE164,
          firstName: nameParts[0] || 'Cliente',
          lastName: nameParts.slice(1).join(' ') || 'Meta',
          privacyConsent: true,
          marketingConsent: false, // Il messaggio spontaneo apre la finestra di servizio ma NON dà consenso al marketing (§04.2)
        });
      }
    } else {
      // Per canali social senza numero immediato (Instagram/Messenger ID)
      const ref = await ExternalRefsRepository.getByExternalId('meta', 'customer', event.senderId);
      if (ref) {
        customer = await CustomerRepository.findByPhone(`+390000000000`); // Placeholder o lookup
      }
      if (!customer) {
        customer = await CustomerRepository.upsertFromExternal({
          phoneE164: `+39${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          firstName: event.senderName || 'Utente Social',
          lastName: 'Direct',
          privacyConsent: true,
          marketingConsent: false,
        });
        await ExternalRefsRepository.upsertRef({
          provider: 'meta',
          entityType: 'customer',
          entityId: customer.id,
          externalId: event.senderId,
        });
      }
    }

    // WhatsApp via Meta: orchestrazione con Gemini e function-calling (§4.1.1)
    if (event.provider === 'meta' && event.channel === 'whatsapp') {
      const { replyText, toolsCalled } = await GeminiBookingAgent.reply({
        customerId: customer.id,
        phone: event.senderPhoneE164 || event.senderId,
        senderName: event.senderName,
        text: rawText,
        imageBase64: event.imageBase64,
        imageMimeType: event.imageMimeType,
      });

      const lastTool = toolsCalled[toolsCalled.length - 1];
      const intentByTool: Record<string, ConversationIntent> = {
        controlla_disponibilita: 'availability_query',
        crea_evento: 'booking_confirm',
        modifica_prenotazione: 'booking_request',
        cancella_prenotazione: 'booking_cancel',
      };

      const geminiResult: ConversationalAgentResult = {
        replyText,
        intent: lastTool ? intentByTool[lastTool] : 'unknown',
        customer,
        escalatedToHuman: false,
        requiresCustomerAction: lastTool !== 'crea_evento' && lastTool !== 'cancella_prenotazione',
      };

      await this.dispatchOutboundReply(event, replyText, customer);
      return geminiResult;
    }

    const sessionKey = `${event.channel}:${event.senderId}`;
    const session = dialogSessions.get(sessionKey) || { turnCount: 0, lastInteraction: Date.now() };
    session.turnCount += 1;
    session.lastInteraction = Date.now();
    dialogSessions.set(sessionKey, session);

    // 2. Analisi dell'Intento
    const intent = this.detectIntent(lower, session);

    let result: ConversationalAgentResult;

    switch (intent) {
      case 'human_escalation': {
        result = {
          replyText:
            'Certamente! Ho inoltrato la tua richiesta alla nostra reception. Un nostro operatore ti contatterà al più presto su questo numero per assisterti al meglio.',
          intent: 'human_escalation',
          customer,
          escalatedToHuman: true,
          requiresCustomerAction: false,
        };
        break;
      }

      case 'booking_confirm': {
        if (session.lastHoldId) {
          const confirmation = await AvailabilityService.confirmHold(session.lastHoldId);
          if (confirmation.success && confirmation.appointment) {
            session.lastHoldId = undefined; // Reset dello stato di hold
            result = {
              replyText: `Fantastico ${customer.first_name}! Il tuo appuntamento è confermato con successo per ${this.formatSpokenDate(
                confirmation.appointment.starts_at
              )}. Ti invieremo un promemoria via messaggio il giorno prima!`,
              intent: 'booking_confirm',
              customer,
              confirmedAppointmentId: confirmation.appointment.id,
              escalatedToHuman: false,
              requiresCustomerAction: false,
            };
            break;
          }
        }

        result = {
          replyText:
            'Non ho trovato una prenotazione in sospeso da confermare. Per quale giorno e orario vorresti fissare il tuo appuntamento?',
          intent: 'unknown',
          customer,
          escalatedToHuman: false,
          requiresCustomerAction: true,
        };
        break;
      }

      case 'booking_request': {
        // Cerca slot e crea subito un Hold a garanzia (§04.2: Nessuna conferma senza hold riuscito)
        const targetDate = this.extractDateFromText(lower);
        const slots = await AvailabilityService.findAvailableSlots({ targetDate });

        if (slots.length > 0) {
          const selectedSlot = slots[0];
          const holdResult = await AvailabilityService.reserveHold({
            customerId: customer.id,
            staffId: selectedSlot.staffId,
            serviceId: selectedSlot.serviceId,
            startsAt: selectedSlot.startsAt,
            endsAt: selectedSlot.endsAt,
            idempotencyKey: randomUUID(),
          });

          if (holdResult.success && holdResult.hold) {
            session.lastHoldId = holdResult.hold.id;
            session.proposedSlots = slots;

            const spokenTime = this.formatSpokenDate(selectedSlot.startsAt);
            result = {
              replyText: `Ho bloccato per te il posto con ${selectedSlot.staffName} per ${spokenTime}. Rispondi "Sì" o "Confermo" entro 7 minuti per bloccarlo definitivamente!`,
              intent: 'booking_hold',
              customer,
              holdId: holdResult.hold.id,
              suggestedSlots: slots,
              escalatedToHuman: false,
              requiresCustomerAction: true,
            };
            break;
          }
        }

        result = {
          replyText:
            'Al momento per quella data non ho trovato slot liberi con i requisiti richiesti. Vuoi che verifichi per il giorno successivo o preferisci parlare con la reception?',
          intent: 'availability_query',
          customer,
          escalatedToHuman: false,
          requiresCustomerAction: true,
        };
        break;
      }

      case 'availability_query': {
        const targetDate = this.extractDateFromText(lower);
        const slots = await AvailabilityService.findAvailableSlots({ targetDate });
        session.proposedSlots = slots;

        if (slots.length === 0) {
          result = {
            replyText:
              'Mi dispiace, non risultano disponibilità immediate per la data richiesta. Ti va bene un altro orario o preferisci che ti metta in contatto con il salone?',
            intent: 'availability_query',
            customer,
            escalatedToHuman: false,
            requiresCustomerAction: true,
          };
        } else {
          const first = slots[0];
          const second = slots[1];
          const optionsText = second
            ? `alle ${this.formatHour(first.startsAt)} con ${first.staffName} oppure alle ${this.formatHour(
                second.startsAt
              )} con ${second.staffName}`
            : `alle ${this.formatHour(first.startsAt)} con ${first.staffName}`;

          result = {
            replyText: `Certamente ${customer.first_name}! Abbiamo posto ${optionsText}. Quale orario preferisci?`,
            intent: 'availability_query',
            customer,
            suggestedSlots: slots,
            escalatedToHuman: false,
            requiresCustomerAction: true,
          };
        }
        break;
      }

      case 'booking_cancel': {
        result = {
          replyText:
            'Ho preso nota della tua richiesta di disdetta. Per tutelare le prenotazioni con caparra o concordate, ho passato la tua richiesta alla reception che ti darà conferma immediata.',
          intent: 'booking_cancel',
          customer,
          escalatedToHuman: true,
          requiresCustomerAction: false,
        };
        break;
      }

      case 'greeting':
      default: {
        result = {
          replyText: `Ciao ${customer.first_name}! Sono l'assistente virtuale di TurboBooking. Posso aiutarti a trovare disponibilità, prenotare un trattamento o verificare i tuoi orari. Come posso aiutarti oggi?`,
          intent: intent === 'greeting' ? 'greeting' : 'unknown',
          customer,
          escalatedToHuman: false,
          requiresCustomerAction: true,
        };
        break;
      }
    }

    // 3. Invio della risposta sul canale di provenienza (§04.2, §04.4)
    await this.dispatchOutboundReply(event, result.replyText, customer);

    return result;
  },

  /**
   * Riconoscimento rapido dell'intento con euristiche semantiche
   */
  detectIntent(text: string, session: DialogSession): ConversationIntent {
    if (
      text.includes('operatore') ||
      text.includes('persona') ||
      text.includes('umano') ||
      text.includes('parlare con qualcuno') ||
      text.includes('chiamatemi') ||
      session.turnCount > 6
    ) {
      return 'human_escalation';
    }

    if (
      text === 'si' ||
      text === 'sì' ||
      text.includes('confermo') ||
      text.includes('va bene') ||
      text.includes('ok perfetto') ||
      text.includes('conferma')
    ) {
      if (session.lastHoldId) {
        return 'booking_confirm';
      }
    }

    if (
      text.includes('prenota') ||
      text.includes('vorrei fissare') ||
      text.includes('voglio fissare') ||
      text.includes('prendere appuntamento') ||
      text.includes('taglio alle')
    ) {
      return 'booking_request';
    }

    if (
      text.includes('disponibilità') ||
      text.includes('posto') ||
      text.includes('orari') ||
      text.includes('avete libero') ||
      text.includes('quando posso')
    ) {
      return 'availability_query';
    }

    if (text.includes('disdire') || text.includes('annullare') || text.includes('cancellare')) {
      return 'booking_cancel';
    }

    if (
      text === 'ciao' ||
      text.startsWith('ciao') ||
      text.startsWith('buongiorno') ||
      text.startsWith('salve') ||
      text.startsWith('buonasera')
    ) {
      return 'greeting';
    }

    return 'unknown';
  },

  /**
   * Invia la risposta generata attraverso l'adapter appropriato (Meta o GHL)
   */
  async dispatchOutboundReply(
    event: InboundMessageEvent,
    replyText: string,
    customer: CustomerRow
  ): Promise<void> {
    if (event.provider === 'meta') {
      if (event.channel === 'whatsapp' && event.senderPhoneE164) {
        await MetaSender.sendWhatsAppText({
          toPhone: event.senderPhoneE164,
          text: replyText,
        });
      } else {
        await MetaSender.sendGraphMessage({
          recipientId: event.senderId,
          text: replyText,
        });
      }
    } else if (event.provider === 'ghl') {
      const channel = new GoHighLevelChannel(
        (event.channel as 'sms' | 'email' | 'whatsapp' | 'instagram' | 'messenger') || 'whatsapp'
      );
      await channel.send(
        {
          recipientAddress: event.senderPhoneE164 || event.senderId,
          body: replyText,
          isTransactional: true,
          locationId: event.locationId,
        },
        customer
      );
    }
  },

  /**
   * Formatta data e ora in linguaggio parlato italiano (§04.5)
   */
  formatSpokenDate(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      const days = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
      const months = [
        'gennaio',
        'febbraio',
        'marzo',
        'aprile',
        'maggio',
        'giugno',
        'luglio',
        'agosto',
        'settembre',
        'ottobre',
        'novembre',
        'dicembre',
      ];

      const dayName = days[date.getDay()];
      const dayNum = date.getDate();
      const monthName = months[date.getMonth()];
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const mins = String(date.getUTCMinutes()).padStart(2, '0');

      return `${dayName} ${dayNum} ${monthName} alle ore ${hours}:${mins}`;
    } catch {
      return isoDate;
    }
  },

  formatHour(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const mins = String(date.getUTCMinutes()).padStart(2, '0');
      return `${hours}:${mins}`;
    } catch {
      return '15:30';
    }
  },

  extractDateFromText(text: string): string {
    const today = new Date();
    if (text.includes('domani')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }
    if (text.includes('dopodomani')) {
      const dayAfter = new Date(today);
      dayAfter.setDate(today.getDate() + 2);
      return dayAfter.toISOString().split('T')[0];
    }
    return today.toISOString().split('T')[0];
  },
};
