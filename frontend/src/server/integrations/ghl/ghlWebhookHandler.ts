import { verify } from 'crypto';
import { GhlInboundContactDto } from './ghlContactMapper';

export type GhlInboundChannel = 'sms' | 'whatsapp' | 'instagram' | 'messenger';

export function normalizeGhlChannel(messageType: string): GhlInboundChannel | null {
  switch (messageType.trim().toLowerCase()) {
    case 'sms': return 'sms';
    case 'whatsapp': return 'whatsapp';
    case 'ig':
    case 'instagram': return 'instagram';
    case 'fb':
    case 'messenger': return 'messenger';
    default: return null;
  }
}

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
  messageType: string;
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
   * Verifica X-GHL-Signature (Ed25519) sul raw body, come da specifica HighLevel.
   */
  verifySignature(rawBody: string, signatureHeader?: string | null): boolean {
    const publicKey = process.env.GHL_WEBHOOK_PUBLIC_KEY || [
      '-----BEGIN PUBLIC KEY-----',
      'MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=',
      '-----END PUBLIC KEY-----',
    ].join('\n');

    if (!signatureHeader) {
      return process.env.NODE_ENV === 'test' ||
        (process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_WEBHOOKS === 'true');
    }

    try {
      return verify(
        null,
        Buffer.from(rawBody, 'utf8'),
        publicKey,
        Buffer.from(signatureHeader, 'base64')
      );
    } catch {
      return false;
    }
  },

  /**
   * Effettua il parsing e normalizza il payload GHL
   */
  parsePayload(payload: Record<string, unknown>): GhlWebhookEvent {
    const eventType = (payload.type || payload.eventType || payload.event) as string;
    const eventId = (payload.webhookId || payload.webhook_id || payload.eventId || payload.event_id) as string | undefined;
    const locationId = (payload.locationId || payload.location_id) as string | undefined;

    if (eventType === 'InboundMessage' || payload.messageType) {
      const msgData: GhlInboundMessageDto = {
        messageId: (payload.messageId || payload.message_id || '') as string,
        conversationId: (payload.conversationId || '') as string,
        locationId: locationId || '',
        contactId: (payload.contactId || '') as string,
        phone: (payload.phone || payload.from) as string | undefined,
        email: payload.email as string | undefined,
        messageType: String(payload.messageType || payload.message_type || ''),
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
