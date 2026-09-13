import { CustomerRow } from '../../db/supabaseClient';
import { TimeSlot } from '../booking/availabilityService';

// =============================================================================
// TURBOBOOKING - CONVERSATIONAL TYPES
// Contratti di dati per il motore conversazionale unificato Meta AI / GHL / Voice
// =============================================================================

export interface InboundMessageEvent {
  provider: 'meta' | 'ghl';
  channel: 'whatsapp' | 'instagram' | 'messenger' | 'sms' | 'voice';
  senderId: string;
  senderPhoneE164?: string;
  senderName?: string;
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
  timestamp: number;
  rawPayload: Record<string, unknown>;
  locationId?: string;
}

export type ConversationIntent =
  | 'greeting'
  | 'availability_query'
  | 'booking_request'
  | 'booking_hold'
  | 'booking_confirm'
  | 'booking_cancel'
  | 'human_escalation'
  | 'unknown';

export interface ConversationalAgentResult {
  replyText: string;
  intent: ConversationIntent;
  customer: CustomerRow;
  holdId?: string;
  confirmedAppointmentId?: string;
  suggestedSlots?: TimeSlot[];
  escalatedToHuman: boolean;
  requiresCustomerAction: boolean;
}
