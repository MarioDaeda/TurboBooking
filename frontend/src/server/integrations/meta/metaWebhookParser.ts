// =============================================================================
// TURBOBOOKING - META WEBHOOK PARSER & NORMALIZER
// Accoglie ed estrae messaggi da WhatsApp Cloud API, Instagram, Messenger e Lead Ads
// =============================================================================

export interface NormalizedMetaMessage {
  messageId: string;
  channel: 'whatsapp' | 'instagram' | 'messenger' | 'leadgen';
  senderId: string; // WhatsApp phone number oppure ID utente scoped Facebook/Instagram
  senderPhoneE164?: string;
  senderName?: string;
  text: string;
  imageMediaId?: string;
  imageMimeType?: string;
  timestamp: number;
  rawPayload: Record<string, unknown>;
}

export interface NormalizedMetaStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  phoneNumberId?: string;
  pricingCategory?: string;
  error?: string;
}

export const MetaWebhookParser = {
  parseStatuses(body: Record<string, unknown>): NormalizedMetaStatus[] {
    const results: NormalizedMetaStatus[] = [];
    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      if (!Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        const value = change.value as Record<string, unknown> | undefined;
        if (!value || !Array.isArray(value.statuses)) continue;
        const metadata = value.metadata as Record<string, unknown> | undefined;
        for (const item of value.statuses as Array<Record<string, unknown>>) {
          const status = String(item.status || '');
          if (!['sent', 'delivered', 'read', 'failed'].includes(status) || !item.id) continue;
          const pricing = item.pricing as Record<string, unknown> | undefined;
          const errors = Array.isArray(item.errors) ? item.errors as Array<Record<string, unknown>> : [];
          results.push({
            messageId: String(item.id),
            status: status as NormalizedMetaStatus['status'],
            phoneNumberId: metadata?.phone_number_id ? String(metadata.phone_number_id) : undefined,
            pricingCategory: pricing?.category ? String(pricing.category) : undefined,
            error: errors[0]?.title ? String(errors[0].title) : undefined,
          });
        }
      }
    }
    return results;
  },

  /**
   * Effettua il parsing del webhook di Meta e restituisce una lista di messaggi normalizzati
   */
  parse(body: Record<string, unknown>): NormalizedMetaMessage[] {
    const results: NormalizedMetaMessage[] = [];
    const entries = Array.isArray(body.entry) ? body.entry : [];

    for (const entry of entries) {
      // 1. WhatsApp Cloud API
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          const value = change.value as Record<string, unknown> | undefined;
          if (!value) continue;

          // Gestione messaggi WhatsApp
          if (Array.isArray(value.messages)) {
            const contacts = Array.isArray(value.contacts) ? (value.contacts as Array<Record<string, unknown>>) : [];
            const firstContact = contacts[0];
            const profileName = (firstContact?.profile as Record<string, unknown>)?.name as string | undefined;

            for (const msg of value.messages) {
              const msgId = msg.id || `wa_${Date.now()}`;
              const from = msg.from; // Numero mittente (es. "393401234567")
              const phoneE164 = from ? (from.startsWith('+') ? from : `+${from}`) : undefined;
              let text = '';

              if (msg.type === 'text' && msg.text?.body) {
                text = msg.text.body;
              } else if (msg.type === 'interactive' && msg.interactive?.button_reply?.title) {
                text = msg.interactive.button_reply.title;
              } else if (msg.type === 'button' && msg.button?.text) {
                text = msg.button.text;
              }

              const imageMediaId = msg.type === 'image' && msg.image?.id ? String(msg.image.id) : undefined;
              const imageMimeType = msg.type === 'image' && msg.image?.mime_type
                ? String(msg.image.mime_type)
                : undefined;

              if (from && (text || imageMediaId)) {
                results.push({
                  messageId: msgId,
                  channel: 'whatsapp',
                  senderId: from,
                  senderPhoneE164: phoneE164,
                  senderName: profileName,
                  text: text.trim(),
                  imageMediaId,
                  imageMimeType,
                  timestamp: Number(msg.timestamp || Date.now() / 1000) * 1000,
                  rawPayload: msg,
                });
              }
            }
          }

          // Gestione Meta Lead Ads (nuovo lead generato da inserzione FB/IG)
          if (value.leadgen_id) {
            results.push({
              messageId: String(value.leadgen_id),
              channel: 'leadgen',
              senderId: String(value.leadgen_id),
              text: 'Nuovo lead acquisito da Meta Lead Ad',
              timestamp: Number(value.created_time || Date.now()),
              rawPayload: value,
            });
          }
        }
      }

      // 2. Messenger / Instagram Direct Messaging
      if (Array.isArray(entry.messaging)) {
        const objectType = (body.object as string) || '';
        const channel = objectType.includes('instagram') ? 'instagram' : 'messenger';

        for (const item of entry.messaging) {
          const sender = item.sender as { id: string } | undefined;
          const message = item.message as { mid: string; text?: string } | undefined;

          if (sender?.id && message?.text) {
            results.push({
              messageId: message.mid || `meta_msg_${Date.now()}`,
              channel,
              senderId: sender.id,
              text: message.text.trim(),
              timestamp: Number(item.timestamp || Date.now()),
              rawPayload: item,
            });
          }
        }
      }
    }

    return results;
  },
};
