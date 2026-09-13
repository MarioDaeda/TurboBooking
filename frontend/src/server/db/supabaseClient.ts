import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TURBOBOOKING - SUPABASE CLIENT & TYPE DEFINITIONS (SERVER ONLY)
// Adattato allo schema reale:
// - bookings (start_at, end_at, hold_expires_at, status: BookingStatus)
// - operators (id, name, active, is_bookable_online, sort_order)
// - customers (id, first_name, last_name, phone nullable, email, notes)
// - services (id, name, duration_minutes, price, active, ...)
// =============================================================================

export type BookingStatus =
  | 'hold'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'expired';

export type BookingSource = 'dashboard' | 'ai_phone' | 'whatsapp' | 'ghl' | 'manual';

export interface BookingRow {
  id: string;
  service_id: string;
  operator_id: string;
  customer_id: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  hold_expires_at: string | null;
  notes?: string | null;
  source?: BookingSource | string | null;
  idempotency_key?: string | null;
  created_at?: string;
  updated_at?: string;
  price_snapshot?: number | null;
  service_name_snapshot?: string | null;
  external_id?: string | null;
}

// Alias di compatibilità per codice pre-migrazione
export type AppointmentHoldRow = BookingRow;

export interface OperatorRow {
  id: string;
  name: string;
  active: boolean;
  is_bookable_online: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  short_name: string | null;
  category: string;
  category_color: string | null;
  is_bookable_online: boolean;
  is_quick_choice: boolean;
  posa_minutes: number | null;
  has_variants: boolean;
  sanificazione: boolean;
  display_order: number;
}

export interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null; // Nullable nel database reale
  email: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;

  has_privacy_consent: boolean;
  marketing_consent: boolean;
  privacy_consent_at?: string | null;
  marketing_consent_at?: string | null;

  // Campo ausiliario per compatibilità TypeScript
  phone_e164?: string;
}

export interface InboundWebhookRow {
  id: string;
  provider: 'ghl' | 'meta' | 'google' | 'stripe' | 'bettercallq';
  external_id: string | null;
  signature_valid: boolean;
  payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
  error: string | null;
  processing_status: 'pending' | 'processing' | 'processed' | 'failed';
  processing_started_at: string | null;
  retention_expires_at: string | null;
}

export interface ProcessedProviderEventRow {
  id: string;
  provider: string;
  event_type: string;
  external_id: string;
  processing_status: 'processing' | 'processed' | 'failed';
  processing_started_at: string | null;
  processed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExternalRefRow {
  id: string;
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

export interface WorkingHoursRow {
  id: string;
  operator_id: string;
  day_of_week: number; // ISO: 1=Lunedì, ..., 7=Domenica
  start_time: string; // "09:00:00" (fuso Europe/Rome)
  end_time: string; // "19:00:00"
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BlockedPeriodRow {
  id: string;
  operator_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseSchema {
  services: ServiceRow;
  operators: OperatorRow;
  customers: CustomerRow;
  bookings: BookingRow;
  working_hours: WorkingHoursRow;
  blocked_periods: BlockedPeriodRow;
  inbound_webhooks: InboundWebhookRow;
  processed_provider_events: ProcessedProviderEventRow;
  external_refs: ExternalRefRow;
  notification_messages: NotificationMessageRow;
}

// Client singleton reference
let adminClientInstance: SupabaseClient | null = null;

/**
 * Restituisce il client Supabase amministrativo (Service Role).
 * Può essere chiamato solo sul server (protetto da 'server-only').
 * Se le credenziali non sono presenti o non valide, solleva un errore esplicito.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('your-project-id')) {
    throw new Error(
      'Configurazione Supabase mancante: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY non configurate in .env.local. Impossibile inizializzare il client amministrativo.'
    );
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
