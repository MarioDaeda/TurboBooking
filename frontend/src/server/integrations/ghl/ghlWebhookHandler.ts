import { createHmac, timingSafeEqual } from 'crypto';
import { GhlInboundContactDto } from './ghlContactMapper';

// =============================================================================
// TURBOBOOKING - GHL WEBHOOK HANDLER
// Verifica firma HMAC e normalizza eventi di contatto e messaggistica inbound
// =============================================================================

export interface GhlInboundMessageDto {
  messageId: string;
  conversationId: string;
  locationId: string;
  contactId: string;
  phone?: string;
  email?: string;
  messageType: 'SMS' | 'WhatsApp' | 'IG' | 'FB' | 'Email';
  body: string;
  direction: 'inbound' | 'outbound';
  attachments?: string[];
}

export type GhlWebhookEvent =
  | { type: 'ContactCreate' | 'ContactUpdate'; data: GhlInboundContactDto; locationId?: string; eventId?: string }
  | { type: 'InboundMessage'; data: GhlInboundMessageDto; locationId?: string; eventId?: string }
  | { type: 'Other'; raw: Record<string, unknown>; eventId?: string };

export const GhlWebhookHandler = {
  /**
   * Verifica la firma HMAC del webhook GHL
   */
  verifySignature(rawBody: string, signatureHeader?: string | null): boolean {
    const secret = process.env.GHL_WEBHOOK_SECRET;
    // In assenza di secret configurato in dev, accetta per test
    if (!secret || secret.includes('your-')) {
      return true;
    }

    if (!signatureHeader) {
      return false;
    }

    try {
      const hmac = createHmac('sha256', secret);
      const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
      const signature = Buffer.from(signatureHeader, 'utf8');

      if (digest.length !== signature.length) {
        return false;
      }
      return timingSafeEqual(digest, signature);
    } catch {
      return false;
    }
  },

  /**
   * Effettua il parsing e normalizza il payload GHL
   */
  parsePayload(payload: Record<string, unknown>): GhlWebhookEvent {
    const eventType = (payload.type || payload.eventType || payload.event) as string;
    const eventId = (payload.eventId || payload.id || `ghl_evt_${Date.now()}`) as string;
    const locationId = (payload.locationId || payload.location_id) as string | undefined;

    if (eventType === 'InboundMessage' || payload.messageType) {
      const msgData: GhlInboundMessageDto = {
        messageId: (payload.messageId || payload.id || eventId) as string,
        conversationId: (payload.conversationId || '') as string,
        locationId: locationId || '',
        contactId: (payload.contactId || '') as string,
        phone: (payload.phone || payload.from) as string | undefined,
        email: payload.email as string | undefined,
        messageType: ((payload.messageType as string) || 'WhatsApp') as GhlInboundMessageDto['messageType'],
        body: (payload.body || payload.message || payload.text || '') as string,
        direction: 'inbound',
        attachments: Array.isArray(payload.attachments) ? (payload.attachments as string[]) : undefined,
      };

      return {
        type: 'InboundMessage',
        data: msgData,
        locationId,
        eventId,
      };
    }

    if (eventType === 'ContactCreate' || eventType === 'ContactUpdate') {
      return {
        type: eventType,
        data: (payload.contact || payload) as GhlInboundContactDto,
        locationId,
        eventId,
      };
    }

    return {
      type: 'Other',
      raw: payload,
      eventId,
    };
  },
};
