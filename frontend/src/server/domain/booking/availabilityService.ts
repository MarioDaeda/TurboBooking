import { AppointmentRepository } from '../../db/repositories';
import { AppointmentHoldRow } from '../../db/supabaseClient';

// =============================================================================
// TURBOBOOKING - AVAILABILITY & HOLD DOMAIN SERVICE
// Calcolo slot e gestione Hold transazionali con budget p95 < 250ms (§01, §02)
// =============================================================================

export interface TimeSlot {
  startsAt: string; // ISO 8601
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

export const AvailabilityService = {
  /**
   * Ricerca slot disponibili per un servizio e data
   */
  async findAvailableSlots({
    serviceId,
    targetDate, // YYYY-MM-DD
    preferredStaffId,
  }: {
    venueId?: string;
    serviceId?: string;
    targetDate?: string;
    preferredStaffId?: string;
  }): Promise<TimeSlot[]> {
    const date = targetDate || new Date().toISOString().split('T')[0];

    // Mock/algoritmo di disponibilità rispettoso dei segmenti di lavoro
    const baseStaff = [
      { id: 'st-01', name: 'Gianluca Tadonio' },
      { id: 'st-02', name: 'Elena Bianchi' },
      { id: 'st-03', name: 'Marco Barber' },
    ];

    const targetStaff = preferredStaffId
      ? baseStaff.filter((s) => s.id === preferredStaffId)
      : baseStaff;

    const slots: TimeSlot[] = [];
    const hours = ['10:00', '11:30', '15:30', '17:00'];

    for (const st of targetStaff) {
      for (const hr of hours) {
        slots.push({
          startsAt: `${date}T${hr}:00.000Z`,
          endsAt: `${date}T${hr}:45.000Z`,
          staffId: st.id,
          staffName: st.name,
          serviceId: serviceId || 'srv-taglio',
          serviceName: 'Taglio & Styling',
          priceCents: 3500,
        });
      }
    }

    return slots.slice(0, 4); // Ritorna le opzioni principali
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
    endsAt: string;
    idempotencyKey: string;
  }): Promise<HoldResult> {
    const resolvedVenue = venueId || process.env.DEFAULT_VENUE_ID || 'v-001';

    // Regola: verifica se lo slot è valido
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
   * Promuove un Hold ad appuntamento confermato
   */
  async confirmHold(holdId: string): Promise<{ success: boolean; appointment?: AppointmentHoldRow }> {
    const hold = await AppointmentRepository.confirmHold(holdId);
    if (!hold) {
      return { success: false };
    }
    return { success: true, appointment: hold };
  },
};
