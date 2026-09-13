import { CustomerRow } from '../../db/supabaseClient';
import { NotificationRepository } from '../../db/repositories';
import { ghlClient } from './ghlClient';

// =============================================================================
// TURBOBOOKING - NOTIFICATION CHANNEL INTERFACE & GHL ADAPTER
// Definito in §4.2: Tutta la messaggistica in uscita passa da una sola interfaccia.
// =============================================================================

export interface OutboundMessage {
  organizationId?: string;
  customerId?: string;
  appointmentId?: string;
  recipientAddress: string; // Telefono o Email
  contactId?: string;
  subject?: string;
  body: string;
  isTransactional: boolean; // true = promemoria/conferma, false = marketing
  locationId?: string;
}

export interface DeliveryReceipt {
  success: boolean;
  messageId?: string;
  channel: 'sms' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'push';
  provider: 'ghl' | 'direct_meta' | 'internal';
  error?: string;
}

export interface NotificationChannel {
  readonly kind: 'sms' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'push';
  send(msg: OutboundMessage, customer?: CustomerRow | null): Promise<DeliveryReceipt>;
  supports(customer: CustomerRow | null): boolean;
}

export class GoHighLevelChannel implements NotificationChannel {
  readonly kind: 'sms' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'push';
  private locationToken?: string;

  constructor(
    kind: 'sms' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'push',
    locationToken?: string
  ) {
    this.kind = kind;
    this.locationToken = locationToken || process.env.GHL_LOCATION_TOKEN;
  }

  /**
   * Verifica consenso prima dell'invio (§04.2):
   * Per messaggi transazionali (es. conferma booking/promemoria) basta il privacy consent.
   * Per messaggi promozionali/marketing è obbligatorio il marketing_consent esplicito.
   */
  supports(customer: CustomerRow | null): boolean {
    if (!customer) return true; // Se l'anagrafica non è ancora registrata, si valuta sul canale
    return Boolean(customer.has_privacy_consent);
  }

  async send(msg: OutboundMessage, customer?: CustomerRow | null): Promise<DeliveryReceipt> {
    const isAllowed = msg.isTransactional
      ? !customer || customer.has_privacy_consent
      : Boolean(customer?.marketing_consent);

    if (!isAllowed) {
      await NotificationRepository.log({
        orgId: msg.organizationId,
        customerId: msg.customerId,
        appointmentId: msg.appointmentId,
        channel: this.kind,
        provider: 'ghl',
        toAddress: msg.recipientAddress,
        bodyPreview: msg.body,
        status: 'rejected_no_consent',
        consentChecked: true,
        error: 'Invio respinto: consenso marketing o privacy mancante',
      });

      return {
        success: false,
        channel: this.kind,
        provider: 'ghl',
        error: 'Consenso mancante',
      };
    }

    try {
      const ghlTypeMap: Record<string, 'SMS' | 'WhatsApp' | 'Email' | 'IG' | 'FB'> = {
        sms: 'SMS',
        whatsapp: 'WhatsApp',
        email: 'Email',
        instagram: 'IG',
        messenger: 'FB',
      };
      const messageType = ghlTypeMap[this.kind];
      if (!messageType) throw new Error(`Canale GHL non supportato: ${this.kind}`);

      const locationId = msg.locationId || process.env.GHL_LOCATION_ID;
      if (!locationId) throw new Error('GHL non configurato: location ID mancante');
      const params: Parameters<typeof ghlClient.sendMessage>[0] = {
        locationId,
        type: messageType,
        message: msg.body,
        subject: msg.subject,
      };
      if (this.kind === 'email') params.email = msg.recipientAddress;
      else if (this.kind === 'sms' || this.kind === 'whatsapp') params.phone = msg.recipientAddress;
      else params.contactId = msg.contactId || msg.recipientAddress;
      const result = await ghlClient.sendMessage(params, this.locationToken);

      await NotificationRepository.log({
        orgId: msg.organizationId,
        customerId: msg.customerId,
        appointmentId: msg.appointmentId,
        channel: this.kind,
        provider: 'ghl',
        toAddress: msg.recipientAddress,
        bodyPreview: msg.body,
        status: result.status,
        providerMessageId: result.messageId,
        consentChecked: true,
      });

      return {
        success: result.status !== 'failed',
        messageId: result.messageId,
        channel: this.kind,
        provider: 'ghl',
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await NotificationRepository.log({
        orgId: msg.organizationId,
        customerId: msg.customerId,
        appointmentId: msg.appointmentId,
        channel: this.kind,
        provider: 'ghl',
        toAddress: msg.recipientAddress,
        bodyPreview: msg.body,
        status: 'failed',
        error: errorMessage,
        consentChecked: true,
      });

      return {
        success: false,
        channel: this.kind,
        provider: 'ghl',
        error: errorMessage,
      };
    }
  }
}
