import { romeLocalToUtc } from '../../../lib/romeTime';
import { isDate, isUuid } from '../../http/api';
import {
  BookingRepository,
  ServiceRepository,
  OperatorRepository,
  WorkingHoursRepository,
  BlockedPeriodRepository,
  AppointmentRepository,
} from '../../db/repositories';
import { AppointmentHoldRow, ServiceRow } from '../../db/supabaseClient';

// =============================================================================
// TURBOBOOKING - AVAILABILITY & HOLD DOMAIN SERVICE
// Calcolo disponibilità reale da Supabase:
// - Invocazione preventiva di tb_expire_holds
// - Durata del servizio da services.duration_minutes
// - Orari di lavoro da working_hours (fuso Europe/Rome, ISO 1=Lun ... 7=Dom)
// - Periodi bloccati da blocked_periods
// - Prenotazioni occupanti da bookings (hold, confirmed, completed)
// =============================================================================

export interface TimeSlot {
  startsAt: string; // ISO 8601 UTC
  endsAt: string;
  staffId: string;
  staffName: string;
  serviceId: string;
  serviceName: string;
  priceCents: number;
}

export interface HoldResult {
  success: boolean;
  hold?: AppointmentHoldRow;
  conflictReason?: string;
  suggestedAlternatives?: TimeSlot[];
}

/**
 * Restituisce il giorno della settimana ISO (1=Lunedì, ..., 7=Domenica) per una data in Europe/Rome.
 */
function getRomeIsoDayOfWeek(dateStr: string): number {
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
  }).format(noonUtc);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[dayStr] || 1;
}

/**
 * Restituisce la data odierna nel fuso Europe/Rome in formato 'YYYY-MM-DD'.
 */
function getTodayInRome(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((pt) => [pt.type, pt.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export const AvailabilityService = {
  /**
   * Ricerca slot disponibili per un servizio e data interrogando il database Supabase.
   * - Prima del calcolo invoca tb_expire_holds.
   * - Applica working_hours, blocked_periods e bookings occupanti.
   */
  async findAvailableSlots({
    serviceId,
    targetDate, // YYYY-MM-DD
    preferredStaffId,
    granularityMinutes = 15,
  }: {
    venueId?: string;
    serviceId?: string;
    targetDate?: string;
    preferredStaffId?: string;
    granularityMinutes?: number;
  }): Promise<TimeSlot[]> {
    // 1. Invocazione preventiva di tb_expire_holds per liberare hold scaduti
    if (!Number.isInteger(granularityMinutes) || granularityMinutes < 5 || granularityMinutes > 120 ||
        (targetDate !== undefined && !isDate(targetDate)) ||
        (serviceId !== undefined && !isUuid(serviceId)) ||
        (preferredStaffId !== undefined && !isUuid(preferredStaffId))) throw new Error('TB_INVALID_REQUEST');
    await BookingRepository.expireHolds();

    const date = targetDate || getTodayInRome();

    // 2. Recupero del servizio da Supabase per conoscerne durata e prezzo
    let service: ServiceRow | null = null;
    if (serviceId) {
      service = await ServiceRepository.getById(serviceId);
      if (!service) throw new Error('TB_SERVICE_NOT_FOUND');
    }
    if (!service) {
      // Compatibilità conversazionale: primo servizio solo quando serviceId è omesso
      const services = await ServiceRepository.listActive();
      if (services.length === 0) {
        return [];
      }
      service = services[0];
    }

    if (!service.active) throw new Error('TB_SERVICE_INACTIVE');
    const durationMinutes = service.duration_minutes;
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) throw new Error('TB_DURATION_INVALID');
    const durationMs = durationMinutes * 60 * 1000;
    const priceCents = Math.round(service.price * 100);

    // 3. Determina il giorno della settimana ISO (1=Lun ... 7=Dom) per la data a Roma
    const dayOfWeek = getRomeIsoDayOfWeek(date);

    // 4. Seleziona gli operatori target
    let operators = await OperatorRepository.listActive();
    if (preferredStaffId) {
      operators = operators.filter((op) => op.id === preferredStaffId);
      if (!operators.length) throw new Error('TB_OPERATOR_NOT_FOUND');
    }

    if (operators.length === 0) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const nowMs = Date.now();
    const minLeadTimeMs = 5 * 60 * 1000;

    // 5. Per ciascun operatore calcola i turni, periodi bloccati e appuntamenti
    for (const op of operators) {
      // 5.1 Orario di lavoro per il giorno corrente
      const workingHours = await WorkingHoursRepository.listActiveForDay(dayOfWeek, op.id);
      // Merge overlapping/adjacent shifts, matching PostgreSQL range_agg semantics.
      const shifts = workingHours.map(w => ({ start: romeLocalToUtc(date, w.start_time), end: romeLocalToUtc(date, w.end_time) }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      const merged: typeof shifts = [];
      for (const shift of shifts) {
        const previous = merged[merged.length - 1];
        if (previous && shift.start <= previous.end) {
          if (shift.end > previous.end) previous.end = shift.end;
        } else merged.push({ ...shift });
      }
      for (const shift of merged) {
        // Converti start_time e end_time di Roma in UTC
        const shiftStartUtc = shift.start;
        const shiftEndUtc = shift.end;

        const shiftStartMs = shiftStartUtc.getTime();
        const shiftEndMs = shiftEndUtc.getTime();

        // 5.2 Recupera periodi bloccati (ferie, permessi)
        const blockedPeriods = await BlockedPeriodRepository.listOverlapping({
          operatorId: op.id,
          startAt: shiftStartUtc.toISOString(),
          endAt: shiftEndUtc.toISOString(),
        });

        // 5.3 Recupera prenotazioni che occupano l'operatore (hold, confirmed, completed)
        const occupyingBookings = await BookingRepository.listOccupying({
          operatorId: op.id,
          startAt: shiftStartUtc.toISOString(),
          endAt: shiftEndUtc.toISOString(),
        });

        // 5.4 Generazione degli slot a intervalli regolari (granularityMinutes)
        const stepMs = granularityMinutes * 60 * 1000;
        for (let slotStart = shiftStartMs; slotStart + durationMs <= shiftEndMs; slotStart += stepMs) {
          const slotEnd = slotStart + durationMs;

          // Se l'appuntamento cade nel passato o entro il lead time, scarta
          if (slotStart < nowMs + minLeadTimeMs) {
            continue;
          }

          // Verifica sovrapposizione con periodi bloccati
          const isBlocked = blockedPeriods.some((b) => {
            const bStart = new Date(b.start_at).getTime();
            const bEnd = new Date(b.end_at).getTime();
            return slotStart < bEnd && slotEnd > bStart;
          });
          if (isBlocked) {
            continue;
          }

          // Verifica sovrapposizione con prenotazioni occupanti
          const isOccupied = occupyingBookings.some((bk) => {
            const bkStart = new Date(bk.start_at).getTime();
            const bkEnd = new Date(bk.end_at).getTime();
            return slotStart < bkEnd && slotEnd > bkStart;
          });
          if (isOccupied) {
            continue;
          }

          slots.push({
            startsAt: new Date(slotStart).toISOString(),
            endsAt: new Date(slotEnd).toISOString(),
            staffId: op.id,
            staffName: op.name,
            serviceId: service.id,
            serviceName: service.name,
            priceCents,
          });
        }
      }

    }

    // 6. Ordina gli slot cronologicamente per orario di inizio
    slots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    return slots;
  },

  /**
   * Crea un Hold temporaneo (7 minuti) con garanzia di non-overbooking (§04.5)
   */
  async reserveHold({
    venueId,
    customerId,
    staffId,
    serviceId,
    startsAt,
    endsAt,
    idempotencyKey,
  }: {
    venueId?: string;
    customerId: string;
    staffId: string;
    serviceId: string;
    startsAt: string;
    endsAt?: string;
    idempotencyKey: string;
  }): Promise<HoldResult> {
    const resolvedVenue = venueId || process.env.DEFAULT_VENUE_ID || 'v-001';

    const hold = await AppointmentRepository.createHold({
      venueId: resolvedVenue,
      customerId,
      staffId,
      serviceId,
      startsAt,
      endsAt,
      idempotencyKey,
    });

    return {
      success: true,
      hold,
    };
  },

  /**
   * Promuove un Hold ad appuntamento confermato.
   * La conferma è considerata riuscita SOLTANTO se lo stato restituito è 'confirmed' (expired non è una conferma).
   */
  async confirmHold(holdId: string): Promise<{ success: boolean; appointment?: AppointmentHoldRow }> {
    const hold = await AppointmentRepository.confirmHold(holdId);
    if (!hold || hold.status !== 'confirmed') {
      return { success: false };
    }
    return { success: true, appointment: hold };
  },

  /**
   * Cancella una prenotazione tramite RPC tb_change_booking
   */
  async cancelAppointment(appointmentId: string): Promise<{ success: boolean; appointment?: AppointmentHoldRow; motivo?: string }> {
    try {
      const appointment = await BookingRepository.cancelBooking(appointmentId);
      return { success: true, appointment };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, motivo: message };
    }
  },

  /**
   * Sposta una prenotazione su un nuovo slot tramite RPC tb_change_booking
   */
  async rescheduleAppointment({
    appointmentId,
    startsAt,
    endsAt,
    staffId,
  }: {
    appointmentId: string;
    startsAt: string;
    endsAt?: string;
    staffId?: string;
  }): Promise<{ success: boolean; appointment?: AppointmentHoldRow; motivo?: string }> {
    try {
      const appointment = await BookingRepository.rescheduleBooking({
        bookingId: appointmentId,
        startAt: startsAt,
        endAt: endsAt || null,
        operatorId: staffId || null,
      });
      return { success: true, appointment };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, motivo: message };
    }
  },
};
