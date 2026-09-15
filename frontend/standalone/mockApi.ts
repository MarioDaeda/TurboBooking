/**
 * Backend simulato per la versione "file unico" di TurboBooking (TurboBooking.html).
 *
 * Intercetta le chiamate fetch verso /api/v1/* e le serve in memoria partendo dai dati demo
 * di src/data/mockData.ts, così l'app completa funziona aprendo il file con doppio clic,
 * senza terminale, server, Supabase o login. I dati si azzerano a ogni riapertura del file.
 */
import { mockStaff, mockServices, mockClients, mockAppointments } from '@/data/mockData';
import { romeLocalToUtc, getRomeToday, formatRomeDateTime } from '@/lib/romeTime';
import { getWeekDays, defaultSalonHours } from '@/lib/agendaDays';

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  has_privacy_consent: boolean;
}

interface BookingRow {
  id: string;
  customer_id: string;
  operator_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  status: string;
  notes: string | null;
  source: string;
  service_name_snapshot: string | null;
}

// L'app valida gli ID come UUID: convertiamo gli ID demo ("staff-1", "cli-3"...) in UUID stabili.
let uuidCounter = 0;
const nextUuid = (kind: number) =>
  `00000000-0000-4000-8${kind}00-${(++uuidCounter).toString(16).padStart(12, '0')}`;

const staffIds = new Map(mockStaff.map((s) => [s.id, nextUuid(1)]));
const serviceIds = new Map(mockServices.map((s) => [s.id, nextUuid(2)]));
const clientIds = new Map<string, string>();

const operators = mockStaff.map((s) => ({
  id: staffIds.get(s.id)!,
  name: `${s.name} ${s.surname}`.trim(),
  is_active: true,
}));

const services = mockServices.map((s) => ({
  id: serviceIds.get(s.id)!,
  name: s.name,
  short_name: s.shortname,
  category: s.category,
  category_color: s.categoryColor,
  price: s.price,
  duration_minutes: s.durationMinutes,
  posa_minutes: s.posaMinutes ?? null,
  sanificazione: s.sanificazione,
  has_variants: s.hasVariants,
  is_quick_choice: s.isQuickChoice,
  is_bookable_online: s.isOnline,
}));

const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] || 'Cliente', last: parts.slice(1).join(' ') || null };
};

const customers: CustomerRow[] = [];
const addCustomer = (demoId: string, name: string, phone: string, email: string, consent: boolean, notes?: string) => {
  const { first, last } = splitName(name);
  const row: CustomerRow = {
    id: nextUuid(3),
    first_name: first,
    last_name: last,
    phone: phone || null,
    email: email || null,
    notes: notes || null,
    has_privacy_consent: consent,
  };
  customers.push(row);
  if (demoId) clientIds.set(demoId, row.id);
  return row;
};
mockClients.forEach((c) => addCustomer(c.id, c.name, c.phone, c.email, c.hasPrivacyConsent, c.notes));

// Gli appuntamenti demo sono della settimana del 31/08/2026: li spostiamo sulla settimana corrente
// così l'agenda è sempre popolata, qualunque sia il giorno in cui il commerciale apre il file.
const DAY_MS = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const weekShiftDays = Math.round(
  (Date.parse(`${getWeekDays(new Date())[0].isoDate}T12:00:00Z`) - Date.parse('2026-08-31T12:00:00Z')) / DAY_MS
);

const bookings: BookingRow[] = mockAppointments.map((a) => {
  let customerId = clientIds.get(a.clientId);
  if (!customerId) {
    customerId = addCustomer(a.clientId, a.clientName, a.clientPhone, a.clientEmail, a.hasPrivacyConsent).id;
  }
  const start = romeLocalToUtc(addDays(a.date, weekShiftDays), a.startTime);
  return {
    id: nextUuid(4),
    customer_id: customerId,
    operator_id: staffIds.get(a.staffId) ?? operators[0].id,
    service_id: serviceIds.get(a.serviceId) ?? services[0].id,
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + a.durationMinutes * 60_000).toISOString(),
    status: a.status === 'pending' ? 'pending' : 'confirmed',
    notes: a.notes || null,
    source: a.source === 'ONLINE' ? 'whatsapp' : 'dashboard',
    service_name_snapshot: a.serviceName,
  };
});

const idempotency = new Map<string, BookingRow>();
let loggedOut = false;

// --- Helpers HTTP ---------------------------------------------------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const badRequest = () => new ApiError(400, 'Richiesta non valida.');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const isTimestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

const isActive = (b: BookingRow) => b.status !== 'cancelled' && b.status !== 'expired';
const overlaps = (operatorId: string, startMs: number, endMs: number, ignoreId?: string) =>
  bookings.some(
    (b) =>
      b.id !== ignoreId &&
      isActive(b) &&
      b.operator_id === operatorId &&
      Date.parse(b.start_at) < endMs &&
      Date.parse(b.end_at) > startMs
  );

const findService = (id: string) => {
  const srv = services.find((s) => s.id === id);
  if (!srv) throw new ApiError(404, 'Risorsa non trovata.');
  return srv;
};

function createBooking(input: {
  customerId: string;
  operatorId: string;
  serviceId: string;
  startAt: string;
  notes: string | null;
  source: string;
}) {
  const srv = findService(input.serviceId);
  if (!operators.some((o) => o.id === input.operatorId) || !customers.some((c) => c.id === input.customerId)) {
    throw new ApiError(404, 'Risorsa non trovata.');
  }
  const startMs = Date.parse(input.startAt);
  const endMs = startMs + srv.duration_minutes * 60_000;
  if (overlaps(input.operatorId, startMs, endMs)) {
    throw new ApiError(409, 'Conflitto di prenotazione o stato non consentito.');
  }
  const row: BookingRow = {
    id: nextUuid(4),
    customer_id: input.customerId,
    operator_id: input.operatorId,
    service_id: srv.id,
    start_at: new Date(startMs).toISOString(),
    end_at: new Date(endMs).toISOString(),
    status: 'confirmed',
    notes: input.notes,
    source: input.source,
    service_name_snapshot: srv.name,
  };
  bookings.push(row);
  return row;
}

async function readBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init?.body || typeof init.body !== 'string') throw badRequest();
  const body = JSON.parse(init.body);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest();
  return body;
}

// --- Receptionist AI simulato (sezione Comunicazioni) ----------------------------------------

const pendingProposals = new Map<string, { serviceId: string; operatorId: string; startAt: string }>();

function findFreeSlot(serviceId: string, fromTomorrow: boolean) {
  const srv = findService(serviceId);
  const today = getRomeToday();
  const earliest = Date.now() + 30 * 60_000;
  for (let d = fromTomorrow ? 1 : 0; d < 21; d++) {
    const iso = addDays(today, d);
    const hours = defaultSalonHours[new Date(`${iso}T12:00:00Z`).getUTCDay()];
    if (!hours.isOpen) continue;
    const [oh, om] = hours.openTime.split(':').map(Number);
    const [ch, cm] = hours.closeTime.split(':').map(Number);
    for (let m = oh * 60 + om; m + srv.duration_minutes <= ch * 60 + cm; m += 30) {
      const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const startMs = romeLocalToUtc(iso, time).getTime();
      if (startMs < earliest) continue;
      const op = operators.find((o) => !overlaps(o.id, startMs, startMs + srv.duration_minutes * 60_000));
      if (op) return { serviceId: srv.id, operatorId: op.id, startAt: new Date(startMs).toISOString() };
    }
  }
  return null;
}

function describeSlot(p: { serviceId: string; operatorId: string; startAt: string }) {
  const srv = findService(p.serviceId);
  const op = operators.find((o) => o.id === p.operatorId)!;
  const when = formatRomeDateTime(p.startAt);
  return `${when.weekday} ${when.day} ${when.month} alle ${when.time} con ${op.name.split(' ')[0]} per "${srv.name}" (€ ${srv.price})`;
}

function simulateConversation(body: Record<string, unknown>) {
  const message = body.message;
  if (typeof message !== 'string' || !message.trim()) throw badRequest();
  const phone = typeof body.phone === 'string' ? body.phone : '+393401234567';
  const senderName = typeof body.senderName === 'string' ? body.senderName : 'Cliente';
  const firstName = splitName(senderName).first;
  const text = message.toLowerCase();
  const pending = pendingProposals.get(phone);

  const result = (replyText: string, intent: string, extra: { holdId?: string; escalatedToHuman?: boolean } = {}) => ({
    replyText,
    intent,
    holdId: extra.holdId,
    escalatedToHuman: !!extra.escalatedToHuman,
    customer: { first_name: firstName },
  });

  if (pending && /\b(s[iì]|ok|okay|confermo|conferma|va bene|perfetto|certo)\b/.test(text)) {
    pendingProposals.delete(phone);
    let customer = customers.find((c) => c.phone && c.phone.replace(/\s/g, '') === phone.replace(/\s/g, ''));
    if (!customer) customer = addCustomer('', senderName, phone, '', true);
    try {
      const booking = createBooking({ ...pending, customerId: customer.id, notes: 'Prenotato dal receptionist AI', source: 'whatsapp' });
      return result(
        `Perfetto ${firstName}! Ti ho prenotato ${describeSlot(pending)}. Riceverai un promemoria il giorno prima. A presto! ✂️`,
        'booking_confirmed',
        { holdId: booking.id }
      );
    } catch {
      return result('Mi dispiace, quello slot è appena stato occupato. Vuoi che ti proponga un altro orario?', 'slot_taken');
    }
  }
  if (pending && /\b(no|altro|diverso|dopo)\b/.test(text)) {
    const next = findFreeSlot(pending.serviceId, true);
    if (next) {
      pendingProposals.set(phone, next);
      return result(`Nessun problema! In alternativa ho ${describeSlot(next)}. Ti va bene?`, 'booking_request', { holdId: `hold_${Date.now()}` });
    }
  }
  if (/(annull|disdic|cancell|sposta)/.test(text)) {
    return result(
      `Certo ${firstName}, ti metto subito in contatto con il salone per gestire la modifica. Un operatore ti risponderà a breve.`,
      'change_request',
      { escalatedToHuman: true }
    );
  }
  if (/(prezz|cost|quanto|listino|tariff)/.test(text)) {
    const list = services
      .filter((s) => s.is_quick_choice)
      .slice(0, 5)
      .map((s) => `• ${s.name}: € ${s.price}`)
      .join('\n');
    return result(`Ecco alcuni dei nostri trattamenti più richiesti:\n${list}\nVuoi prenotarne uno?`, 'price_inquiry');
  }
  if (/(orari|apert|chius|quando siete)/.test(text)) {
    const list = defaultSalonHours
      .slice(1)
      .concat(defaultSalonHours[0])
      .map((h) => `• ${h.day}: ${h.isOpen ? `${h.openTime} - ${h.closeTime}` : 'chiuso'}`)
      .join('\n');
    return result(`I nostri orari:\n${list}`, 'hours_inquiry');
  }
  if (/(prenot|appuntament|posto|disponib|liber|taglio|colore|piega|barba|meches|trattament)/.test(text)) {
    const words = text.split(/[^a-zàèéìòù]+/).filter((w) => w.length > 3);
    const srv =
      services.find((s) => words.some((w) => s.name.toLowerCase().includes(w))) ??
      services.find((s) => s.id === serviceIds.get('srv-5')) ??
      services[0];
    const slot = findFreeSlot(srv.id, /domani/.test(text));
    if (!slot) return result('Al momento non trovo disponibilità nelle prossime settimane. Ti ricontatta il salone!', 'no_availability', { escalatedToHuman: true });
    pendingProposals.set(phone, slot);
    return result(`Ho disponibilità ${describeSlot(slot)}. Confermo la prenotazione?`, 'booking_request', { holdId: `hold_${Date.now()}` });
  }
  if (/(ciao|salve|buongiorno|buonasera|hey)/.test(text)) {
    return result(`Ciao ${firstName}! Posso prenotarti un appuntamento, darti prezzi o orari del salone. Cosa ti serve?`, 'greeting');
  }
  return result(
    'Posso aiutarti a prenotare un appuntamento, comunicarti prezzi e orari. Prova ad esempio con "Vorrei prenotare un taglio domani".',
    'unknown'
  );
}

// --- Router ---------------------------------------------------------------------------------

async function handle(method: string, url: URL, init?: RequestInit): Promise<Response> {
  const path = url.pathname.replace(/^.*?(\/api\/)/, '/api/');

  if (path === '/api/v1/auth/session') {
    if (method === 'GET') return loggedOut ? json({ error: 'Sessione non valida.' }, 401) : json({ authenticated: true });
    if (method === 'DELETE') {
      loggedOut = true;
      return json({ success: true });
    }
    if (method === 'POST') {
      loggedOut = false;
      return json({ success: true });
    }
  }
  if (loggedOut) return json({ error: 'Sessione non valida.' }, 401);

  if (path === '/api/v1/services' && method === 'GET') {
    return json({ success: true, count: services.length, services });
  }
  if (path === '/api/v1/operators' && method === 'GET') {
    return json({ success: true, count: operators.length, operators });
  }
  if (path === '/api/v1/customers') {
    if (method === 'GET') {
      const q = (url.searchParams.get('query') || '').trim().toLowerCase();
      const found = q
        ? customers.filter(
            (c) =>
              `${c.first_name} ${c.last_name || ''}`.toLowerCase().includes(q) ||
              (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''))
          )
        : customers.slice(-50).reverse();
      return json({ success: true, total: found.length, customers: found });
    }
    if (method === 'POST') {
      const body = await readBody(init);
      if (typeof body.firstName !== 'string' || !body.firstName.trim()) throw badRequest();
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
      const row = addCustomer(
        '',
        `${body.firstName} ${str(body.lastName)}`,
        str(body.phone),
        str(body.email),
        body.privacyConsent === true,
        str(body.notes)
      );
      return json({ success: true, customer: row }, 201);
    }
  }
  const customerMatch = path.match(/^\/api\/v1\/customers\/([^/]+)$/);
  if (customerMatch && method === 'PATCH') {
    const row = customers.find((c) => c.id === customerMatch[1]);
    if (!row) return json({ error: 'Cliente non trovato.' }, 404);
    const body = await readBody(init);
    if (typeof body.firstName !== 'string' || !body.firstName.trim()) throw badRequest();
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    row.first_name = body.firstName.trim();
    row.last_name = str(body.lastName);
    row.phone = str(body.phone);
    row.email = str(body.email);
    return json({ success: true, customer: row });
  }
  if (path === '/api/v1/bookings') {
    if (method === 'GET') {
      const startAt = url.searchParams.get('startAt');
      const endAt = url.searchParams.get('endAt');
      if (!isTimestamp(startAt) || !isTimestamp(endAt)) throw badRequest();
      const from = Date.parse(startAt);
      const to = Date.parse(endAt);
      const list = bookings.filter((b) => Date.parse(b.start_at) >= from && Date.parse(b.start_at) < to);
      return json({ success: true, total: list.length, bookings: list });
    }
    if (method === 'POST') {
      const { customerId, operatorId, serviceId, startAt, notes, idempotencyKey } = await readBody(init);
      if (!isUuid(customerId) || !isUuid(operatorId) || !isUuid(serviceId) || !isTimestamp(startAt) ||
          typeof idempotencyKey !== 'string' || !idempotencyKey) throw badRequest();
      const existing = idempotency.get(idempotencyKey);
      if (existing) return json({ success: true, booking: existing }, 201);
      const booking = createBooking({
        customerId, operatorId, serviceId, startAt,
        notes: typeof notes === 'string' ? notes : null,
        source: 'dashboard',
      });
      idempotency.set(idempotencyKey, booking);
      return json({ success: true, booking }, 201);
    }
  }
  const bookingMatch = path.match(/^\/api\/v1\/bookings\/([^/]+)$/);
  if (bookingMatch && method === 'PATCH') {
    const booking = bookings.find((b) => b.id === decodeURIComponent(bookingMatch[1]));
    if (!booking) throw new ApiError(404, 'Risorsa non trovata.');
    const { action, startAt, endAt, operatorId } = await readBody(init);
    if (action === 'reschedule') {
      if (!isTimestamp(startAt) || (endAt !== undefined && !isTimestamp(endAt)) ||
          (operatorId !== undefined && !isUuid(operatorId))) throw badRequest();
      const startMs = Date.parse(startAt);
      const durationMs = Date.parse(booking.end_at) - Date.parse(booking.start_at);
      const endMs = endAt !== undefined ? Date.parse(endAt) : startMs + durationMs;
      if (endMs <= startMs) throw badRequest();
      const targetOperator = operatorId ?? booking.operator_id;
      if (!operators.some((o) => o.id === targetOperator)) throw new ApiError(404, 'Risorsa non trovata.');
      if (overlaps(targetOperator, startMs, endMs, booking.id)) {
        throw new ApiError(409, 'Conflitto di prenotazione o stato non consentito.');
      }
      Object.assign(booking, {
        start_at: new Date(startMs).toISOString(),
        end_at: new Date(endMs).toISOString(),
        operator_id: targetOperator,
      });
      return json({ success: true, booking });
    }
    const statusByAction: Record<string, string> = {
      cancel: 'cancelled', confirm: 'confirmed', complete: 'completed', no_show: 'no_show',
    };
    if (typeof action !== 'string' || !statusByAction[action]) throw badRequest();
    booking.status = statusByAction[action];
    return json({ success: true, booking });
  }
  if (path === '/api/v1/integrations/status' && method === 'GET') {
    return json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      providers: {
        supabase: { connected: true, mode: 'demo_offline', details: 'Versione dimostrativa: dati salvati nel browser' },
        integrationStorage: { ready: true, error: null },
        ghl: { configured: true, webhookUrl: '/api/webhooks/ghl', features: ['conversations_adapter', 'contacts_bidirectional_sync', 'gdpr_allowlist'] },
        meta: { configured: true, webhookUrl: '/api/webhooks/meta', features: ['whatsapp_cloud_api', 'instagram_direct', 'messenger', 'conversational_ai'] },
      },
      metrics: { totalRecentWebhooks: pendingProposals.size, totalRecentNotifications: bookings.filter((b) => b.source === 'whatsapp').length },
      recentWebhooks: [],
      recentNotifications: [],
    });
  }
  if (path === '/api/v1/conversational/simulate' && method === 'POST') {
    const result = simulateConversation(await readBody(init));
    return json({ success: true, result, simulatedAt: new Date().toISOString() });
  }
  return json({ error: 'Risorsa non trovata.' }, 404);
}

export function installMockApi() {
  // crypto.randomUUID richiede un contesto sicuro: alcuni browser non lo espongono per i file locali.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
    Object.defineProperty(crypto, 'randomUUID', {
      value: () => nextUuid(9),
      configurable: true,
    });
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!/^\/api\/|\/api\/v1\//.test(raw)) return realFetch(input, init);
    const url = new URL(raw, 'http://turbobooking.local');
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    // Piccola latenza per rendere realistici gli stati di caricamento.
    await new Promise((resolve) => setTimeout(resolve, 60));
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await handle(method, url, init);
    } catch (err) {
      if (err instanceof ApiError) return json({ error: err.message }, err.status);
      if (err instanceof SyntaxError) return json({ error: 'Richiesta non valida.' }, 400);
      console.error('Mock API failure', err);
      return json({ error: 'Errore interno del servizio.' }, 500);
    }
  };
}
