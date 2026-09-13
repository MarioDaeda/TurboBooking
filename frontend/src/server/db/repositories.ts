import { createHash, randomUUID } from 'crypto';
import {
  getSupabaseAdminClient,
  BookingRow,
  BookingStatus,
  BookingSource,
  OperatorRow,
  ServiceRow,
  CustomerRow,
  WorkingHoursRow,
  BlockedPeriodRow,
  InboundWebhookRow,
  ExternalRefRow,
  NotificationMessageRow,
} from './supabaseClient';

// =============================================================================
// TURBOBOOKING - REPOSITORY LAYER (ADATTATO AL DATABASE REALE)
// Mappature:
// - appointments -> bookings (start_at, end_at, hold_expires_at, status: BookingStatus)
// - staff / staff_id -> operators / operator_id
// - phone_e164 -> phone (nullable)
// - organization_id / venue_id -> non presenti nel nucleo attuale
// =============================================================================

// =============================================================================
// 1. SERVIZI (services)
// =============================================================================

export const ServiceRepository = {
  /**
   * Restituisce tutti i servizi attivi ordinati per display_order
   */
  async listActive(): Promise<ServiceRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw Object.assign(new Error(`Errore durante il recupero dei servizi da Supabase: ${error.message}`), { code: error.code });
    }

    return (data || []) as ServiceRow[];
  },

  async listBookableOnline(): Promise<ServiceRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .eq('is_bookable_online', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw Object.assign(new Error(`Errore durante il recupero dei servizi online: ${error.message}`), { code: error.code });
    }
    return (data || []) as ServiceRow[];
  },

  async searchBookableOnline(query: string): Promise<ServiceRow[]> {
    const clean = query.trim().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
    if (!clean) return [];
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .eq('is_bookable_online', true)
      .or(`name.ilike.%${clean}%,short_name.ilike.%${clean}%,description.ilike.%${clean}%,category.ilike.%${clean}%`)
      .order('display_order', { ascending: true })
      .limit(10);

    if (error) {
      throw Object.assign(new Error(`Errore durante la ricerca dei servizi online: ${error.message}`), { code: error.code });
    }
    return (data || []) as ServiceRow[];
  },

  /**
   * Restituisce tutti i servizi (anche disattivati)
   */
  async listAll(): Promise<ServiceRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw Object.assign(new Error(`Errore durante il recupero di tutti i servizi da Supabase: ${error.message}`), { code: error.code });
    }

    return (data || []) as ServiceRow[];
  },

  /**
   * Recupera un servizio specifico per ID
   */
  async getById(id: string): Promise<ServiceRow | null> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(`Errore durante il recupero del servizio ${id} da Supabase: ${error.message}`), { code: error.code });
    }

    return (data as ServiceRow) || null;
  },
};

// =============================================================================
// 2. OPERATORI (operators)
// =============================================================================

export const OperatorRepository = {
  /**
   * Restituisce tutti gli operatori attivi ordinati per sort_order
   */
  async listActive(): Promise<OperatorRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw Object.assign(new Error(`Errore durante il recupero degli operatori da Supabase: ${error.message}`), { code: error.code });
    }

    return (data || []) as OperatorRow[];
  },

  /**
   * Restituisce gli operatori prenotabili online
   */
  async listBookableOnline(): Promise<OperatorRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('active', true)
      .eq('is_bookable_online', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw Object.assign(new Error(`Errore durante il recupero degli operatori online: ${error.message}`), { code: error.code });
    }

    return (data || []) as OperatorRow[];
  },

  /**
   * Recupera un operatore per ID
   */
  async getById(id: string): Promise<OperatorRow | null> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(`Errore durante il recupero dell'operatore ${id}: ${error.message}`), { code: error.code });
    }

    return (data as OperatorRow) || null;
  },
};

// =============================================================================
// 3. CLIENTI (customers)
// NOTA IMPORTANTE: Il telefono NON è univoco nel nostro schema.
// Una ricerca può restituire più persone: non bisogna scegliere silenziosamente
// la prima o assumere sempre un solo risultato.
// =============================================================================

export class AmbiguousCustomerPhoneError extends Error {
  constructor(public phone: string, public matches: CustomerRow[]) {
    super(
      `Trovati ${matches.length} clienti associati al numero di telefono ${phone}. È richiesta disambiguazione esplicita per nome/id.`
    );
    this.name = 'AmbiguousCustomerPhoneError';
  }
}

export const CustomerRepository = {
  /**
   * Elenca i clienti recenti ordinati per data creazione decrescente
   */
  async listRecent(limit: number = 50): Promise<CustomerRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw Object.assign(new Error(`Errore durante il recupero dei clienti recenti: ${error.message}`), { code: error.code });
    }

    return ((data || []) as CustomerRow[]).map((c) => ({
      ...c,
      phone_e164: c.phone || undefined,
    }));
  },

  /**
   * Cerca clienti per nome, cognome o telefono.
   * Restituisce TUTTI i record corrispondenti (nessuna deduplicazione silenziosa o assunzione di unicità).
   */
  async search(query: string): Promise<CustomerRow[]> {
    const supabase = getSupabaseAdminClient();
    const clean = query.trim();
    if (!clean) return this.listRecent(50);

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .or(`first_name.ilike.%${clean}%,last_name.ilike.%${clean}%,phone.ilike.%${clean}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw Object.assign(new Error(`Errore durante la ricerca clienti: ${error.message}`), { code: error.code });
    }

    return ((data || []) as CustomerRow[]).map((c) => ({
      ...c,
      phone_e164: c.phone || undefined,
    }));
  },

  /**
   * Cerca TUTTI i clienti associati a un numero di telefono (il telefono NON è univoco).
   */
  async findAllByPhone(phone: string): Promise<CustomerRow[]> {
    const supabase = getSupabaseAdminClient();
    const normalized = phone.trim();

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', normalized);

    if (error) {
      throw Object.assign(new Error(`Errore durante la ricerca clienti per telefono: ${error.message}`), { code: error.code });
    }

    return ((data || []) as CustomerRow[]).map((c) => ({
      ...c,
      phone_e164: c.phone || undefined,
    }));
  },

  /**
   * Cerca un cliente per telefono quando ci si aspetta un risultato univoco.
   * Se trova più clienti, solleva AmbiguousCustomerPhoneError (NON sceglie la prima riga).
   */
  async findByPhone(phone: string): Promise<CustomerRow | null> {
    const matches = await this.findAllByPhone(phone);
    if (matches.length === 0) {
      return null;
    }
    if (matches.length === 1) {
      return matches[0];
    }
    throw new AmbiguousCustomerPhoneError(phone, matches);
  },

  /**
   * Recupera un cliente per ID univoco
   */
  async getById(id: string): Promise<CustomerRow | null> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(`Errore recupero cliente per id: ${error.message}`), { code: error.code });
    }

    if (data) {
      return {
        ...data,
        phone_e164: data.phone || undefined,
      } as CustomerRow;
    }

    return null;
  },

  /**
   * Crea un nuovo cliente (telefono può essere null o già presente)
   */
  async create({
    firstName,
    lastName,
    phone,
    email,
    notes,
    privacyConsent,
    marketingConsent,
  }: {
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
    privacyConsent?: boolean;
    marketingConsent?: boolean;
  }): Promise<CustomerRow> {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    const newRow = {
      first_name: firstName,
      last_name: lastName || null,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      has_privacy_consent: privacyConsent ?? false,
      marketing_consent: marketingConsent ?? false,
      privacy_consent_at: privacyConsent ? now : null,
      marketing_consent_at: marketingConsent ? now : null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('customers')
      .insert(newRow)
      .select()
      .single();

    if (error) {
      throw Object.assign(new Error(`Errore inserimento cliente: ${error.message}`), { code: error.code });
    }

    return {
      ...data,
      phone_e164: data.phone || undefined,
    } as CustomerRow;
  },

  /**
   * Inserimento o aggiornamento da canali esterni (es. GHL / Meta).
   * Se il telefono è associato a più clienti, solleva AmbiguousCustomerPhoneError.
   */
  async upsertFromExternal({
    phoneE164,
    firstName,
    lastName,
    email,
    notes,
    privacyConsent,
    marketingConsent,
  }: {
    phoneE164: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    notes?: string | null;
    marketingConsent?: boolean;
    privacyConsent?: boolean;
    orgId?: string;
  }): Promise<CustomerRow> {
    const matches = await this.findAllByPhone(phoneE164);
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();

    if (matches.length > 1) {
      throw new AmbiguousCustomerPhoneError(phoneE164, matches);
    }

    if (matches.length === 1) {
      const existing = matches[0];
      const patch: Record<string, unknown> = {
        first_name: existing.first_name || firstName,
        last_name: existing.last_name || lastName,
        email: existing.email || email || null,
        notes: existing.notes || notes || null,
        updated_at: now,
      };
      if (privacyConsent !== undefined) {
        patch.has_privacy_consent = privacyConsent;
        patch.privacy_consent_at = privacyConsent ? existing.privacy_consent_at || now : null;
      }
      if (marketingConsent !== undefined) {
        patch.marketing_consent = marketingConsent;
        patch.marketing_consent_at = marketingConsent ? existing.marketing_consent_at || now : null;
      }
      const { data, error } = await supabase
        .from('customers')
        .update(patch)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        throw Object.assign(new Error(`Errore aggiornamento cliente: ${error.message}`), { code: error.code });
      }

      return {
        ...data,
        phone_e164: data.phone || undefined,
      } as CustomerRow;
    }

    return await this.create({
      firstName,
      lastName,
      phone: phoneE164,
      email,
      notes,
      privacyConsent,
      marketingConsent,
    });
  },
};

// =============================================================================
// 4. CALENDARIO E PRENOTAZIONI (bookings)
// Collegamento esclusivo alle funzioni SQL (RPC) per le scritture:
// - Prenotazione dalla dashboard: tb_create_booking (p_hold: false)
// - Hold conversazionale: tb_create_booking (p_hold: true)
// - Conferma hold: tb_change_booking (p_action: 'confirm')
// - Spostamento: tb_change_booking (p_action: 'reschedule', p_start_at)
// - Modifica manuale durata: tb_change_booking (p_action: 'reschedule', p_start_at, p_end_at)
// - Cancellazione: tb_change_booking (p_action: 'cancel')
// REGOLA: Nella creazione NON inviare p_end_at (calcolato dal database).
// REGOLA: La chiave di idempotenza viene generata per ogni nuova richiesta e riutilizzata nei retry.
// REGOLA: Una conferma è riuscita SOLTANTO se il risultato contiene status: 'confirmed'.
// =============================================================================

export const BookingRepository = {
  /**
   * Crea una prenotazione (es. dalla dashboard) tramite la funzione RPC tb_create_booking.
   * NON invia p_end_at: il database lo calcola dalla durata del servizio.
   */
  async createBooking({
    customerId,
    operatorId,
    serviceId,
    startAt,
    source = 'dashboard',
    idempotencyKey,
    notes,
    externalId,
  }: {
    customerId: string;
    operatorId: string;
    serviceId: string;
    startAt: string;
    source?: BookingSource;
    idempotencyKey?: string | null;
    notes?: string | null;
    externalId?: string | null;
  }): Promise<BookingRow> {
    const supabase = getSupabaseAdminClient();
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) throw new Error('TB_IDEMPOTENCY_REQUIRED');
    const key = idempotencyKey;

    const { data, error } = await supabase.rpc('tb_create_booking', {
      p_customer_id: customerId,
      p_operator_id: operatorId,
      p_service_id: serviceId,
      p_start_at: startAt,
      p_source: source,
      p_idempotency_key: key,
      p_hold: false,
      p_notes: notes || null,
      p_external_id: externalId || null,
    });

    if (error) {
      throw Object.assign(new Error(`Errore creazione prenotazione (tb_create_booking): ${error.message}`), { code: error.code });
    }

    return data as BookingRow;
  },

  /**
   * Crea un blocco provvisorio (hold conversazionale) tramite la funzione RPC tb_create_booking (p_hold: true).
   * NON invia p_end_at: il database lo calcola automaticamente dalla durata del servizio.
   */
  async createHold({
    customerId,
    operatorId,
    serviceId,
    startAt,
    source = 'whatsapp',
    idempotencyKey,
    notes,
    externalId,
    // Parametri di retrocompatibilità
    staffId,
    startsAt,
  }: {
    customerId: string;
    operatorId?: string;
    staffId?: string;
    serviceId: string;
    startAt?: string;
    startsAt?: string;
    source?: BookingSource | string;
    idempotencyKey?: string | null;
    notes?: string | null;
    externalId?: string | null;
    endAt?: string;
    endsAt?: string;
    holdTtlMinutes?: number;
  }): Promise<BookingRow> {
    const supabase = getSupabaseAdminClient();
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) throw new Error('TB_IDEMPOTENCY_REQUIRED');
    const key = idempotencyKey;
    const resolvedOperatorId = operatorId || staffId;
    const resolvedStartAt = startAt || startsAt;

    if (!resolvedOperatorId) {
      throw new Error('operatorId (o staffId) obbligatorio per creare un hold');
    }
    if (!resolvedStartAt) {
      throw new Error('startAt (o startsAt) obbligatorio per creare un hold');
    }

    const validSources: BookingSource[] = ['dashboard', 'ai_phone', 'whatsapp', 'ghl', 'manual'];
    const resolvedSource = validSources.includes(source as BookingSource)
      ? (source as BookingSource)
      : 'whatsapp';

    const { data, error } = await supabase.rpc('tb_create_booking', {
      p_customer_id: customerId,
      p_operator_id: resolvedOperatorId,
      p_service_id: serviceId,
      p_start_at: resolvedStartAt,
      p_source: resolvedSource,
      p_idempotency_key: key,
      p_hold: true,
      p_notes: notes || null,
      p_external_id: externalId || null,
    });

    if (error) {
      throw Object.assign(new Error(`Errore creazione hold conversazionale (tb_create_booking): ${error.message}`), { code: error.code });
    }

    return data as BookingRow;
  },

  /**
   * Conferma un hold tramite la funzione RPC tb_change_booking (p_action: 'confirm').
   * Una conferma è considerata riuscita SOLTANTO se il risultato contiene status: 'confirmed'.
   * Se il blocco è scaduto o in altro stato, solleva un errore esplicito.
   */
  async confirmHold(holdId: string): Promise<BookingRow> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase.rpc('tb_change_booking', {
      p_booking_id: holdId,
      p_action: 'confirm',
    });

    if (error) {
      throw Object.assign(new Error(`Errore conferma prenotazione ${holdId} (tb_change_booking): ${error.message}`), { code: error.code });
    }

    const booking = data as BookingRow;
    if (!booking || booking.status !== 'confirmed') {
      throw new Error(
        `TB_HOLD_EXPIRED: Conferma hold fallita: la prenotazione ${holdId} ha stato '${booking?.status}', atteso 'confirmed'. Uno stato 'expired' non è una conferma.`
      );
    }

    return booking;
  },

  /**
   * Sposta una prenotazione a un nuovo inizio (e opzionalmente modifica la durata manuale con endAt o l'operatore)
   * tramite la funzione RPC tb_change_booking (p_action: 'reschedule').
   */
  async rescheduleBooking({
    bookingId,
    startAt,
    endAt,
    operatorId,
  }: {
    bookingId: string;
    startAt: string;
    endAt?: string | null;
    operatorId?: string | null;
  }): Promise<BookingRow> {
    const supabase = getSupabaseAdminClient();

    const payload: {
      p_booking_id: string;
      p_action: string;
      p_start_at: string;
      p_end_at?: string;
      p_operator_id?: string;
    } = {
      p_booking_id: bookingId,
      p_action: 'reschedule',
      p_start_at: startAt,
    };

    if (endAt) {
      payload.p_end_at = endAt;
    }
    if (operatorId) {
      payload.p_operator_id = operatorId;
    }

    const { data, error } = await supabase.rpc('tb_change_booking', payload);

    if (error) {
      throw Object.assign(new Error(`Errore spostamento prenotazione ${bookingId} (tb_change_booking): ${error.message}`), { code: error.code });
    }

    return data as BookingRow;
  },

  /**
   * Cancella una prenotazione tramite la funzione RPC tb_change_booking (p_action: 'cancel').
   */
  async cancelBooking(bookingId: string): Promise<BookingRow> {
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase.rpc('tb_change_booking', {
      p_booking_id: bookingId,
      p_action: 'cancel',
    });

    if (error) {
      throw Object.assign(new Error(`Errore cancellazione prenotazione ${bookingId} (tb_change_booking): ${error.message}`), { code: error.code });
    }

    return data as BookingRow;
  },

  /**
   * Modifica generica di stato o parametri tramite RPC tb_change_booking.
   * Azioni supportate: 'confirm' | 'reschedule' | 'cancel' | 'complete' | 'no_show'
   */
  async changeBooking({
    bookingId,
    action,
    startAt,
    endAt,
    operatorId,
  }: {
    bookingId: string;
    action: 'confirm' | 'reschedule' | 'cancel' | 'complete' | 'no_show';
    startAt?: string;
    endAt?: string;
    operatorId?: string;
  }): Promise<BookingRow> {
    const supabase = getSupabaseAdminClient();

    const payload: {
      p_booking_id: string;
      p_action: string;
      p_start_at?: string;
      p_end_at?: string;
      p_operator_id?: string;
    } = {
      p_booking_id: bookingId,
      p_action: action,
    };

    if (startAt) payload.p_start_at = startAt;
    if (endAt) payload.p_end_at = endAt;
    if (operatorId) payload.p_operator_id = operatorId;

    const { data, error } = await supabase.rpc('tb_change_booking', payload);

    if (error) {
      throw Object.assign(new Error(`Errore modifica prenotazione ${bookingId} (azione: ${action}): ${error.message}`), { code: error.code });
    }

    if (action === 'confirm' && (!data || data.status !== 'confirmed')) throw new Error('TB_HOLD_EXPIRED');
    return data as BookingRow;
  },

  /**
   * Aggiorna lo stato di una prenotazione mappando lo stato sull'azione RPC appropriata.
   * Nessuna scrittura diretta con .update() su bookings.
   */
  async updateStatus(bookingId: string, status: BookingStatus): Promise<BookingRow> {
    switch (status) {
      case 'confirmed':
        return await this.confirmHold(bookingId);
      case 'cancelled':
        return await this.cancelBooking(bookingId);
      case 'completed':
        return await this.changeBooking({ bookingId, action: 'complete' });
      case 'no_show':
        return await this.changeBooking({ bookingId, action: 'no_show' });
      default:
        throw new Error(`Transizione di stato a '${status}' non consentita direttamente via RPC.`);
    }
  },

  /**
   * Recupera una prenotazione per ID (lettura SELECT)
   */
  async getById(id: string): Promise<BookingRow | null> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw Object.assign(new Error(`Errore recupero prenotazione ${id}: ${error.message}`), { code: error.code });
    }

    return (data as BookingRow) || null;
  },

  /**
   * Elenca le prenotazioni in un intervallo di date, opzionalmente per operatore (lettura SELECT)
   */
  async listByDateRange({
    startAt,
    endAt,
    operatorId,
  }: {
    startAt: string;
    endAt: string;
    operatorId?: string;
  }): Promise<BookingRow[]> {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('bookings')
      .select('*')
      .lt('start_at', endAt)
      .gt('end_at', startAt)
      .order('start_at', { ascending: true });

    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }

    const { data, error } = await query;
    if (error) {
      throw Object.assign(new Error(`Errore recupero prenotazioni per intervallo: ${error.message}`), { code: error.code });
    }

    return (data || []) as BookingRow[];
  },

  /**
   * Recupera le prenotazioni che occupano l'operatore (esclude 'cancelled' ed 'expired').
   * Usato per il calcolo della disponibilità.
   */
  async listOccupying({
    operatorId,
    startAt,
    endAt,
  }: {
    operatorId?: string;
    startAt: string;
    endAt: string;
  }): Promise<BookingRow[]> {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('bookings')
      .select('*')
      .in('status', ['hold', 'confirmed', 'completed', 'no_show'])
      .lt('start_at', endAt)
      .gt('end_at', startAt)
      .order('start_at', { ascending: true });

    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }

    const { data, error } = await query;
    if (error) {
      throw Object.assign(new Error(`Errore recupero prenotazioni occupanti: ${error.message}`), { code: error.code });
    }

    return (data || []) as BookingRow[];
  },

  /**
   * Invoca la RPC tb_expire_holds per aggiornare gli hold scaduti a 'expired'.
   * Restituisce il numero di righe modificate.
   */
  async expireHolds(): Promise<number> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc('tb_expire_holds');
    if (error) {
      throw Object.assign(new Error(`Errore esecuzione tb_expire_holds: ${error.message}`), { code: error.code });
    }
    return typeof data === 'number' ? data : 0;
  },
};

// =============================================================================
// 5. ORARI DI LAVORO (working_hours)
// Orari settimanali dell'operatore nel fuso Europe/Rome (1=Lunedì ... 7=Domenica)
// =============================================================================

export const WorkingHoursRepository = {
  async listByOperator(operatorId: string): Promise<WorkingHoursRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('working_hours')
      .select('*')
      .eq('operator_id', operatorId)
      .eq('active', true)
      .order('day_of_week', { ascending: true });

    if (error) {
      throw Object.assign(new Error(`Errore recupero orari operatore ${operatorId}: ${error.message}`), { code: error.code });
    }
    return (data || []) as WorkingHoursRow[];
  },

  async listActiveForDay(dayOfWeek: number, operatorId?: string): Promise<WorkingHoursRow[]> {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('working_hours')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .eq('active', true);

    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }

    const { data, error } = await query;
    if (error) {
      throw Object.assign(new Error(`Errore recupero orari per giorno ${dayOfWeek}: ${error.message}`), { code: error.code });
    }
    return (data || []) as WorkingHoursRow[];
  },
};

// =============================================================================
// 6. PERIODI BLOCCATI (blocked_periods)
// =============================================================================

export const BlockedPeriodRepository = {
  async listOverlapping({
    operatorId,
    startAt,
    endAt,
  }: {
    operatorId?: string;
    startAt: string;
    endAt: string;
  }): Promise<BlockedPeriodRow[]> {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('blocked_periods')
      .select('*')
      .lt('start_at', endAt)
      .gt('end_at', startAt);

    if (operatorId) {
      query = query.eq('operator_id', operatorId);
    }

    const { data, error } = await query;
    if (error) {
      throw Object.assign(new Error(`Errore recupero periodi bloccati: ${error.message}`), { code: error.code });
    }
    return (data || []) as BlockedPeriodRow[];
  },
};

/**
 * Alias per compatibilità con codice precedente
 */
export const AppointmentRepository = {
  async createHold({
    customerId,
    serviceId,
    staffId,
    operatorId,
    startsAt,
    startAt,
    idempotencyKey,
  }: {
    venueId?: string;
    customerId: string;
    staffId?: string;
    operatorId?: string;
    serviceId: string;
    startsAt?: string;
    startAt?: string;
    endsAt?: string;
    endAt?: string;
    idempotencyKey: string;
    orgId?: string;
  }): Promise<BookingRow> {
    return await BookingRepository.createHold({
      customerId,
      serviceId,
      operatorId: operatorId || staffId,
      startAt: startAt || startsAt,
      idempotencyKey,
    });
  },

  async confirmHold(holdId: string): Promise<BookingRow | null> {
    return await BookingRepository.confirmHold(holdId);
  },

  async findHold(holdId: string): Promise<BookingRow | null> {
    return await BookingRepository.getById(holdId);
  },

  async cancelBooking(bookingId: string): Promise<BookingRow> {
    return await BookingRepository.cancelBooking(bookingId);
  },

  async rescheduleBooking({
    bookingId,
    startAt,
    endAt,
    operatorId,
  }: {
    bookingId: string;
    startAt: string;
    endAt?: string | null;
    operatorId?: string | null;
  }): Promise<BookingRow> {
    return await BookingRepository.rescheduleBooking({
      bookingId,
      startAt,
      endAt,
      operatorId,
    });
  },
};

// =============================================================================
// 5. INBOUND WEBHOOKS, EXTERNAL REFS, NOTIFICATIONS
// Le tabelle sono server-only e vengono create dalle migrazioni 0004–0007.
// In caso di database non aggiornato l'errore resta esplicito, senza fallback.
// =============================================================================

export class TableNotMigratedError extends Error {
  constructor(public tableName: string) {
    super(
      `La tabella '${tableName}' non è presente nel database Supabase attuale. Questa tabella richiede migrazioni dedicate non ancora eseguite.`
    );
    this.name = 'TableNotMigratedError';
  }
}

function integrationTableError(tableName: string, error: { code?: string; message?: string }): Error {
  if (error.code === '42P01' || error.message?.includes(`'${tableName}'`)) {
    return new TableNotMigratedError(tableName);
  }
  return Object.assign(new Error(`Errore sulla tabella ${tableName}: ${error.message || 'errore sconosciuto'}`), {
    code: error.code,
  });
}

export const InboundWebhookRepository = {
  async save({
    provider,
    externalId,
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
    const stableExternalId = externalId || `payload_${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
    const id = randomUUID();

    const row: InboundWebhookRow = {
      id,
      provider,
      external_id: stableExternalId,
      signature_valid: signatureValid,
      payload,
      received_at: now,
      processed_at: null,
      error: null,
      processing_status: 'pending',
      processing_started_at: null,
      retention_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { data, error } = await supabase
      .from('inbound_webhooks')
      .insert(row)
      .select()
      .single();

    if (error?.code === '23505') {
      const { data: existing, error: lookupError } = await supabase
        .from('inbound_webhooks')
        .select('*')
        .eq('provider', provider)
        .eq('external_id', stableExternalId)
        .single();
      if (lookupError) throw integrationTableError('inbound_webhooks', lookupError);
      return { record: existing as InboundWebhookRow, isDuplicate: true };
    }
    if (error) {
      throw integrationTableError('inbound_webhooks', error);
    }

    return { record: data as InboundWebhookRow, isDuplicate: false };
  },

  async markProcessed(id: string, error?: string): Promise<void> {
    if (error) {
      await this.markFailed(id, error);
      return;
    }
    const supabase = getSupabaseAdminClient();
    const { error: updateError } = await supabase
      .from('inbound_webhooks')
      .update({
        processed_at: new Date().toISOString(),
        error: null,
        processing_status: 'processed',
        processing_started_at: null,
      })
      .eq('id', id);

    if (updateError) {
      throw integrationTableError('inbound_webhooks', updateError);
    }
  },

  async claimForProcessing(id: string): Promise<InboundWebhookRow | null> {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    type ClaimQuery = {
      eq(column: string, value: string): ClaimQuery;
      in(column: string, values: string[]): ClaimQuery;
      lt(column: string, value: string): ClaimQuery;
      select(columns?: string): ClaimQuery;
      maybeSingle(): Promise<{ data: InboundWebhookRow | null; error: { code?: string; message?: string } | null }>;
    };

    const claim = async (applyFilters: (query: ClaimQuery) => ClaimQuery) => applyFilters(
      supabase.from('inbound_webhooks').update({
        processing_status: 'processing',
        processing_started_at: now,
      }) as unknown as ClaimQuery
    ).select().maybeSingle();

    const first = await claim(
      (query) => query.eq('id', id).in('processing_status', ['pending', 'failed'])
    );
    if (first.error) throw integrationTableError('inbound_webhooks', first.error);
    if (first.data) return first.data as InboundWebhookRow;

    const reclaim = await claim(
      (query) => query
        .eq('id', id)
        .eq('processing_status', 'processing')
        .lt('processing_started_at', staleBefore)
    );
    if (reclaim.error) throw integrationTableError('inbound_webhooks', reclaim.error);
    return (reclaim.data as InboundWebhookRow) || null;
  },

  async markFailed(id: string, error: string): Promise<void> {
    const supabase = getSupabaseAdminClient();
    const { error: updateError } = await supabase
      .from('inbound_webhooks')
      .update({ processing_status: 'failed', processing_started_at: null, processed_at: null, error })
      .eq('id', id);
    if (updateError) throw integrationTableError('inbound_webhooks', updateError);
  },

  async listRecent(limit: number = 20): Promise<InboundWebhookRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('inbound_webhooks')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw integrationTableError('inbound_webhooks', error);
    }

    return (data || []) as InboundWebhookRow[];
  },

  async redactExpiredPayloads(): Promise<number> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc('tb_redact_expired_inbound_webhooks');
    if (error) throw integrationTableError('inbound_webhooks', error);
    return typeof data === 'number' ? data : 0;
  },
};

export const ExternalRefsRepository = {
  async getByExternalId(
    provider: 'ghl' | 'meta' | 'google' | 'stripe',
    entityType: 'customer' | 'appointment' | 'venue' | 'staff',
    externalId: string
  ): Promise<ExternalRefRow | null> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('external_refs')
      .select('*')
      .eq('provider', provider)
      .eq('entity_type', entityType)
      .eq('external_id', externalId)
      .maybeSingle();

    if (error) {
      throw integrationTableError('external_refs', error);
    }

    return (data as ExternalRefRow) || null;
  },

  async upsertRef({
    provider,
    entityType,
    entityId,
    externalId,
    metadata = {},
  }: {
    provider: 'ghl' | 'meta' | 'google' | 'stripe';
    entityType: 'customer' | 'appointment' | 'venue' | 'staff';
    entityId: string;
    externalId: string;
    orgId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ExternalRefRow> {
    const now = new Date().toISOString();
    const supabase = getSupabaseAdminClient();

    const row: ExternalRefRow = {
      id: randomUUID(),
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

    const { data, error } = await supabase
      .from('external_refs')
      .upsert(row, { onConflict: 'provider,entity_type,entity_id' })
      .select()
      .single();

    if (error) {
      throw integrationTableError('external_refs', error);
    }

    return (data as ExternalRefRow) || row;
  },
};

export const NotificationRepository = {
  async log({
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
    const { data, error: insertError } = await supabase
      .from('notification_messages')
      .insert(row)
      .select()
      .single();

    if (insertError) {
      throw integrationTableError('notification_messages', insertError);
    }

    return (data as NotificationMessageRow) || row;
  },

  async listRecent(limit: number = 20): Promise<NotificationMessageRow[]> {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('notification_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw integrationTableError('notification_messages', error);
    }

    return (data || []) as NotificationMessageRow[];
  },

  async updateProviderStatus({
    providerMessageId,
    status,
    error,
  }: {
    providerMessageId: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    error?: string | null;
  }): Promise<void> {
    const supabase = getSupabaseAdminClient();
    const { error: updateError } = await supabase
      .from('notification_messages')
      .update({ status, error: error || null })
      .eq('provider', 'direct_meta')
      .eq('provider_message_id', providerMessageId);
    if (updateError) throw integrationTableError('notification_messages', updateError);
  },
};
