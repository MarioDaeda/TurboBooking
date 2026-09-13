// =============================================================================
// TURBOBOOKING - META DIRECT SENDER (WHATSAPP CLOUD API & GRAPH API)
// Fornisce l'adapter di risposta diretta Meta se non si transita da GHL
// =============================================================================

export interface MetaSendResponseResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function allowProviderMocks(): boolean {
  return process.env.NODE_ENV === 'test' ||
    (process.env.NODE_ENV !== 'production' && process.env.ALLOW_PROVIDER_MOCKS === 'true');
}

export const MetaSender = {
  /**
   * Invia un messaggio di testo diretto via WhatsApp Cloud API
   */
  async sendWhatsAppText({
    toPhone,
    text,
  }: {
    toPhone: string;
    text: string;
  }): Promise<MetaSendResponseResult> {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId || token.includes('your-')) {
      if (!allowProviderMocks()) {
        return { success: false, error: 'Meta WhatsApp non configurato' };
      }
      return {
        success: true,
        messageId: `mock_wa_${Date.now()}`,
      };
    }

    try {
      const cleanPhone = toPhone.replace(/\+/g, '').trim();
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: false, body: text },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Meta WhatsApp API error [${res.status}]: ${errText}` };
      }

      const data = await res.json();
      const messageId = data.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Invia messaggio a utente Instagram Direct o Facebook Messenger via Graph API
   */
  async sendGraphMessage({
    recipientId,
    text,
  }: {
    recipientId: string;
    text: string;
  }): Promise<MetaSendResponseResult> {
    const token = process.env.META_PAGE_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN;

    if (!token || token.includes('your-')) {
      if (!allowProviderMocks()) {
        return { success: false, error: 'Meta Graph non configurato' };
      }
      return {
        success: true,
        messageId: `mock_graph_${Date.now()}`,
      };
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: err };
      }

      const data = await res.json();
      return { success: true, messageId: data.message_id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
};
