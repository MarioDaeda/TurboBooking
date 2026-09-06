import { randomUUID } from 'crypto';
import {
  getSupabaseAdminClient,
  InboundWebhookRow,
  CustomerRow,
  ExternalRefRow,
  NotificationMessageRow,
  AppointmentHoldRow,
} from './supabaseClient';

// =============================================================================
// TURBOBOOKING - REPOSITORY LAYER (SUPABASE + LOCAL IN-MEMORY FALLBACK)
// Garantisce persistenza e idempotenza conformemente alle specifiche di §04
// =============================================================================

// In-memory fallback stores per garantire funzionamento immediato anche pre-configurazione env
const memWebhooks = new Map<string, InboundWebhookRow>();
const memCustomers = new Map<string, CustomerRow>();
const memExternalRefs = new Map<string, ExternalRefRow>();
const memNotifications = new Map<string, NotificationMessageRow>();
const memAppointments = new Map<string, AppointmentHoldRow>();

// Seed minimo di clienti per test immediato
const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANIZATION_ID || '00000000-0000-0000-0000-000000000001';
memCustomers.set('+393401234567', {
  id: 'c-001',
  organization_id: DEFAULT_ORG_ID,
  first_name: 'Chiara',
  last_name: 'Ferrandi',
  phone_e164: '+393401234567',
  email: 'chiara.ferrandi@example.com',
  has_privacy_consent: true,
  marketing_consent: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const InboundWebhookRepository = {
  async save({
    provider,
    externalId,
    organizationId,
    signatureValid,
    payload,
  }: {
    provider: 'ghl' | 'meta' | 'google' | 'stripe' | 'bettercallq';
    externalId: string | null;
    organizationId?: string | null;
    signatureValid: boolean;
    payload: Record<string, unknown>;
  }): Promise<{ record: InboundWebhookRow; isDuplicate: boolean }> {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    if (supabase) {
      if (externalId) {
        // Verifica deduplica
        const { data: existing } = await supabase
          .from('inbound_webhooks')
          .select('*')
          .eq('provider', provider)
          .eq('external_id', externalId)
          .maybeSingle();

        if (existing) {
          return { record: existing as InboundWebhookRow, isDuplicate: true };
        }
      }

      const id = randomUUID();
      const row: InboundWebhookRow = {
        id,
        provider,
        external_id: externalId,
        organization_id: organizationId || null,
        signature_valid: signatureValid,
        payload,
        received_at: now,
        processed_at: null,
        error: null,
      };

      const { data, error } = await supabase
        .from('inbound_webhooks')
        .insert(row)
        .select()
        .single();

      if (error) {
        // Possibile race condition su unique constraint (provider, external_id)
        const { data: existing } = await supabase
          .from('inbound_webhooks')
          .select('*')
          .eq('provider', provider)
          .eq('external_id', externalId)
          .single();
        return { record: (existing || row) as InboundWebhookRow, isDuplicate: true };
      }

      return { record: data as InboundWebhookRow, isDuplicate: false };
    }

    // Modalità fallback in-memory
    const dedupKey = externalId ? `${provider}:${externalId}` : null;
    if (dedupKey && memWebhooks.has(dedupKey)) {
      return { record: memWebhooks.get(dedupKey)!, isDuplicate: true };
    }

    const newRecord: InboundWebhookRow = {
      id: randomUUID(),
      provider,
      external_id: externalId,
      organization_id: organizationId || null,
      signature_valid: signatureValid,
      payload,
      received_at: now,
      processed_at: null,
      error: null,
    };

    if (dedupKey) {
      memWebhooks.set(dedupKey, newRecord);
    }
    memWebhooks.set(newRecord.id, newRecord);
    return { record: newRecord, isDuplicate: false };
  },

  async markProcessed(id: string, error?: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    if (supabase) {
      await supabase
        .from('inbound_webhooks')
        .update({
          processed_at: now,
          error: error || null,
        })
        .eq('id', id);
      return;
    }

    const rec = memWebhooks.get(id);
    if (rec) {
      rec.processed_at = now;
      rec.error = error || null;
    }
  },

  async listRecent(limit: number = 20): Promise<InboundWebhookRow[]> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from('inbound_webhooks')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(limit);
      return (data || []) as InboundWebhookRow[];
    }

    return Array.from(memWebhooks.values())
      .slice(-limit)
      .reverse();
  },
};

export const CustomerRepository = {
  async findByPhone(phoneE164: string, orgId?: string): Promise<CustomerRow | null> {
    const supabase = getSupabaseAdminClient();
    const targetOrg = orgId || DEFAULT_ORG_ID;

    if (supabase) {
      const query = supabase
        .from('customers')
        .select('*')
        .eq('phone_e164', phoneE164);
      
      if (orgId) {
        query.eq('organization_id', targetOrg);
      }

      const { data } = await query.maybeSingle();
      return (data as CustomerRow) || null;
    }

    // Ricerca in-memory (per telefono esatto o normalizzato)
    const match = Array.from(memCustomers.values()).find(
      (c) => c.phone_e164 === phoneE164 || c.phone_e164.replace(/\D/g, '') === phoneE164.replace(/\D/g, '')
    );
    return match || null;
  },

  async upsertFromExternal({
    phoneE164,
    firstName,
    lastName,
    email,
    marketingConsent,
    privacyConsent,
    orgId,
  }: {
    phoneE164: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    marketingConsent?: boolean;
    privacyConsent?: boolean;
    orgId?: string;
  }): Promise<CustomerRow> {
    const targetOrg = orgId || DEFAULT_ORG_ID;
    const existing = await this.findByPhone(phoneE164, targetOrg);
    const now = new Date().toISOString();

    // REGOLA DI DOMINIO TB: I dati TB prevalgono tranne che per gli OPT-OUT:
    // un opt-out (false) vince SEMPRE su qualunque consenso precedentemente accordato.
    const resolvedMarketingConsent =
      marketingConsent === false
        ? false
        : existing
        ? existing.marketing_consent
        : marketingConsent ?? false;

    const resolvedPrivacyConsent =
      privacyConsent === false
        ? false
        : existing
        ? existing.has_privacy_consent
        : privacyConsent ?? true;

    const supabase = getSupabaseAdminClient();

    if (supabase) {
      if (existing) {
        const { data } = await supabase
          .from('customers')
          .update({
            // Aggiorna nome/email solo se prima erano vuoti, TB prevale
            first_name: existing.first_name || firstName,
            last_name: existing.last_name || lastName,
            email: existing.email || email || null,
            marketing_consent: resolvedMarketingConsent,
            has_privacy_consent: resolvedPrivacyConsent,
            updated_at: now,
          })
          .eq('id', existing.id)
          .select()
          .single();
        return data as CustomerRow;
      }

      const newId = randomUUID();
      const newRow: CustomerRow = {
        id: newId,
        organization_id: targetOrg,
        first_name: firstName,
        last_name: lastName,
        phone_e164: phoneE164,
        email: email || null,
        has_privacy_consent: resolvedPrivacyConsent,
        marketing_consent: resolvedMarketingConsent,
        created_at: now,
        updated_at: now,
      };

      const { data } = await supabase.from('customers').insert(newRow).select().single();
      return data as CustomerRow;
    }

    if (existing) {
      existing.first_name = existing.first_name || firstName;
      existing.last_name = existing.last_name || lastName;
      existing.email = existing.email || email || null;
      existing.marketing_consent = resolvedMarketingConsent;
      existing.has_privacy_consent = resolvedPrivacyConsent;
      existing.updated_at = now;
      return existing;
    }

    const created: CustomerRow = {
      id: `c-${Date.now()}`,
      organization_id: targetOrg,
      first_name: firstName,
      last_name: lastName,
      phone_e164: phoneE164,
      email: email || null,
      has_privacy_consent: resolvedPrivacyConsent,
      marketing_consent: resolvedMarketingConsent,
      created_at: now,
      updated_at: now,
    };
    memCustomers.set(phoneE164, created);
    return created;
  },
};

export const ExternalRefsRepository = {
  async getByExternalId(
    provider: 'ghl' | 'meta' | 'google' | 'stripe',
    entityType: 'customer' | 'appointment' | 'venue' | 'staff',
    externalId: string
  ): Promise<ExternalRefRow | null> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from('external_refs')
        .select('*')
        .eq('provider', provider)
        .eq('entity_type', entityType)
        .eq('external_id', externalId)
        .maybeSingle();
      return (data as ExternalRefRow) || null;
    }

    const key = `${provider}:${entityType}:${externalId}`;
    return memExternalRefs.get(key) || null;
  },

  async upsertRef({
    provider,
    entityType,
    entityId,
    externalId,
    orgId,
    metadata = {},
  }: {
    provider: 'ghl' | 'meta' | 'google' | 'stripe';
    entityType: 'customer' | 'appointment' | 'venue' | 'staff';
    entityId: string;
    externalId: string;
    orgId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ExternalRefRow> {
    const targetOrg = orgId || DEFAULT_ORG_ID;
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();

    const row: ExternalRefRow = {
      id: randomUUID(),
      organization_id: targetOrg,
      provider,
      entity_type: entityType,
      entity_id: entityId,
      external_id: externalId,
      metadata,
      synced_at: now,
      sync_state: 'ok',
      sync_error: null,
      created_at: now,
    };

    if (supabase) {
      const { data } = await supabase
        .from('external_refs')
        .upsert(row, { onConflict: 'provider,entity_type,entity_id' })
        .select()
        .single();
      return (data as ExternalRefRow) || row;
    }

    const key = `${provider}:${entityType}:${externalId}`;
    memExternalRefs.set(key, row);
    return row;
  },
};

export const NotificationRepository = {
  async log({
    orgId,
    customerId,
    appointmentId,
    channel,
    provider,
    toAddress,
    bodyPreview,
    status,
    providerMessageId,
    error,
    consentChecked,
  }: {
    orgId?: string;
    customerId?: string | null;
    appointmentId?: string | null;
    channel: 'sms' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'push';
    provider: 'ghl' | 'direct_meta' | 'internal';
    toAddress: string;
    bodyPreview: string;
    status: NotificationMessageRow['status'];
    providerMessageId?: string | null;
    error?: string | null;
    consentChecked: boolean;
  }): Promise<NotificationMessageRow> {
    const row: NotificationMessageRow = {
      id: randomUUID(),
      organization_id: orgId || DEFAULT_ORG_ID,
      customer_id: customerId || null,
      appointment_id: appointmentId || null,
      channel,
      provider,
      template_key: null,
      to_address: toAddress,
      body_preview: bodyPreview.slice(0, 150),
      status,
      provider_message_id: providerMessageId || null,
      error: error || null,
      consent_checked: consentChecked,
      scheduled_for: null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from('notification_messages')
        .insert(row)
        .select()
        .single();
      return (data as NotificationMessageRow) || row;
    }

    memNotifications.set(row.id, row);
    return row;
  },

  async listRecent(limit: number = 20): Promise<NotificationMessageRow[]> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from('notification_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      return (data || []) as NotificationMessageRow[];
    }

    return Array.from(memNotifications.values())
      .slice(-limit)
      .reverse();
  },
};

export const AppointmentRepository = {
  async createHold({
    venueId,
    customerId,
    staffId,
    serviceId,
    startsAt,
    endsAt,
    idempotencyKey,
    orgId,
  }: {
    venueId: string;
    customerId: string;
    staffId: string;
    serviceId: string;
    startsAt: string;
    endsAt: string;
    idempotencyKey: string;
    orgId?: string;
  }): Promise<AppointmentHoldRow> {
    // TTL standard hold: 7 minuti (§04.5)
    const expiresAt = new Date(Date.now() + 7 * 60 * 1000).toISOString();
    const row: AppointmentHoldRow = {
      id: randomUUID(),
      organization_id: orgId || DEFAULT_ORG_ID,
      venue_id: venueId,
      customer_id: customerId,
      staff_id: staffId,
      service_id: serviceId,
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'hold',
      expires_at: expiresAt,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
    };

    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('appointments')
        .insert(row)
        .select()
        .single();
      if (!error && data) {
        return data as AppointmentHoldRow;
      }
    }

    memAppointments.set(row.id, row);
    return row;
  },

  async confirmHold(holdId: string): Promise<AppointmentHoldRow | null> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', holdId)
        .select()
        .single();
      return (data as AppointmentHoldRow) || null;
    }

    const item = memAppointments.get(holdId);
    if (item) {
      item.status = 'confirmed';
      return item;
    }
    return null;
  },

  async findHold(holdId: string): Promise<AppointmentHoldRow | null> {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', holdId)
        .maybeSingle();
      return (data as AppointmentHoldRow) || null;
    }

    return memAppointments.get(holdId) || null;
  },
};
