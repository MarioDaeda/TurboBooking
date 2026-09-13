import { GhlContactPayload } from './ghlContactMapper';

// =============================================================================
// TURBOBOOKING - GHL API CLIENT
// Gestione chiamate HTTP verso LeadConnector con rate-limiting e resilient fallback
// =============================================================================

export interface GhlSendMessageParams {
  contactId: string;
  type: 'SMS' | 'WhatsApp' | 'Email' | 'IG' | 'FB';
  message: string;
  subject?: string;
  toNumber?: string;
  emailTo?: string;
  status: 'pending';
}

export class GoHighLevelClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.baseUrl = process.env.GHL_API_BASE_URL || 'https://services.leadconnectorhq.com';
    this.clientId = process.env.GHL_CLIENT_ID || '';
    this.clientSecret = process.env.GHL_CLIENT_SECRET || '';
  }

  private isConfigured(): boolean {
    // Le chiamate Conversations/Contacts usano il location access token; le
    // credenziali OAuth restano disponibili per il futuro flusso di installazione.
    return Boolean(this.baseUrl);
  }

  private allowMocks(): boolean {
    return process.env.NODE_ENV === 'test' ||
      (process.env.NODE_ENV !== 'production' && process.env.ALLOW_PROVIDER_MOCKS === 'true');
  }

  /**
   * Upsert di un contatto nella Location GHL specificata
   */
  async upsertContact(
    locationId: string,
    payload: GhlContactPayload,
    locationToken?: string
  ): Promise<{ contactId: string; isNew: boolean }> {
    if (!this.isConfigured() || !locationToken) {
      if (!this.allowMocks()) throw new Error('GHL non configurato: credenziali o location token mancanti');
      const mockId = `ghl_c_${Math.random().toString(36).substring(2, 9)}`;
      return { contactId: mockId, isNew: true };
    }

    const res = await fetch(`${this.baseUrl}/contacts/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${locationToken}`,
        Version: 'v3',
      },
      body: JSON.stringify({
        locationId,
        ...payload,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`GHL upsertContact error [${res.status}]: ${errorText}`);
    }

    const data = await res.json();
    return {
      contactId: data.contact?.id || data.id,
      isNew: Boolean(data.isNew),
    };
  }

  /**
   * Invia un messaggio tramite l'API Conversations di GHL
   */
  async sendMessage(
    params: GhlSendMessageParams,
    locationToken?: string
  ): Promise<{ messageId: string; status: 'sent' | 'queued' | 'failed' }> {
    if (!this.isConfigured() || !locationToken) {
      if (!this.allowMocks()) throw new Error('GHL non configurato: credenziali o location token mancanti');
      return {
        messageId: `ghl_msg_${Date.now()}`,
        status: 'queued',
      };
    }

    const res = await fetch(`${this.baseUrl}/conversations/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${locationToken}`,
        Version: 'v3',
      },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GHL sendMessage error [${res.status}]: ${err}`);
    }

    const data = await res.json() as { messageId?: string; messageIds?: string[] };
    const messageId = data.messageId || data.messageIds?.[0];
    if (!messageId) throw new Error('GHL sendMessage: risposta priva di messageId');
    return {
      messageId,
      status: 'queued',
    };
  }

  /**
   * Aggiunge tag a un contatto su GHL (es. per triggerare workflow o escalation)
   */
  async addTags(
    contactId: string,
    tags: string[],
    locationToken?: string
  ): Promise<void> {
    if (!this.isConfigured() || !locationToken) {
      if (!this.allowMocks()) throw new Error('GHL non configurato: credenziali o location token mancanti');
      return;
    }

    const res = await fetch(`${this.baseUrl}/contacts/${encodeURIComponent(contactId)}/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${locationToken}`,
        Version: 'v3',
      },
      body: JSON.stringify({ tags }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`GHL addTags error [${res.status}]: ${errorText}`);
    }
  }
}

export const ghlClient = new GoHighLevelClient();
