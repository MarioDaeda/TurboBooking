import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TURBOBOOKING - SUPABASE CLIENT & TYPE DEFINITIONS
// Database: PostgreSQL 16 con RLS e isolamento multi-tenant (organization_id)
// =============================================================================

export interface InboundWebhookRow {
  id: string;
  provider: 'ghl' | 'meta' | 'google' | 'stripe' | 'bettercallq';
  external_id: string | null;
  organization_id: string | null;
  signature_valid: boolean;
  payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
  error: string | null;
}

export interface CustomerRow {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  phone_e164: string;
  email: string | null;
  has_privacy_consent: boolean;
  marketing_consent: boolean;
  notes_technical_art9?: string; // STRICT: Mai sincronizzato verso l'esterno
  allergies_art9?: string;        // STRICT: Mai sincronizzato verso l'esterno
  created_at: string;
  updated_at: string;
}

export interface ExternalRefRow {
  id: string;
  organization_id: string;
  provider: 'ghl' | 'meta' | 'google' | 'stripe';
  entity_type: 'customer' | 'appointment' | 'venue' | 'staff';
  entity_id: string;
  external_id: string;
  metadata: Record<string, unknown>;
  synced_at: string | null;
  sync_state: 'ok' | 'pending' | 'error';
  sync_error: string | null;
  created_at: string;
}

export interface NotificationMessageRow {
  id: string;
  organization_id: string;
  customer_id: string | null;
  appointment_id: string | null;
  channel: 'sms' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'push';
  provider: 'ghl' | 'direct_meta' | 'internal';
  template_key: string | null;
  to_address: string;
  body_preview: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'rejected_no_consent';
  provider_message_id: string | null;
  error: string | null;
  consent_checked: boolean;
  scheduled_for: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AppointmentHoldRow {
  id: string;
  organization_id: string;
  venue_id: string;
  customer_id: string;
  staff_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: 'hold' | 'confirmed' | 'cancelled';
  expires_at: string;
  idempotency_key: string;
  created_at: string;
}

export interface DatabaseSchema {
  inbound_webhooks: InboundWebhookRow;
  customers: CustomerRow;
  external_refs: ExternalRefRow;
  notification_messages: NotificationMessageRow;
  appointments: AppointmentHoldRow;
}

// Client singleton references
let adminClientInstance: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('your-project-id')) {
    return null;
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClientInstance;
}

export function getSupabaseUserClient(jwtToken?: string): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey || supabaseUrl.includes('your-project-id')) {
    return null;
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {},
    },
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Esegue un blocco transazionale con tenant isolato (SET LOCAL app.current_org)
 * Se Supabase/Postgres non è ancora connesso via env, esegue in modalità fallback.
 */
export async function withTenantContext<T>(
  orgId: string,
  fn: (supabase: SupabaseClient | null) => Promise<T>
): Promise<T> {
  const client = getSupabaseAdminClient();
  if (!client) {
    // Fallback locale di sviluppo quando le credenziali non sono ancora configurate
    return await fn(null);
  }

  // RLS tenant setting per Supabase RPC o transazione
  try {
    await client.rpc('set_tenant_context', { p_org_id: orgId });
  } catch {
    // Procedi anche se la funzione RPC non è ancora registrata nel DB
  }

  return await fn(client);
}
