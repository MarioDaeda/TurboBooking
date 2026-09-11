import { Appointment } from '@/types';
import { mockAppointments, mockServices, mockStaff } from '@/data/mockData';

// =============================================================================
// TURBOBOOKING - STORE PRENOTAZIONI WHATSAPP
// Tiene in memoria (processo server) gli appuntamenti creati via WhatsApp e
// calcola la disponibilità reale sugli orari dello staff e sugli appuntamenti.
// Quando Supabase sarà collegato, sostituire con AppointmentRepository.
// =============================================================================

const IT_DAY_NAMES = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const AGENDA_DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];
const SLOT_STEP_MINUTES = 30;

const globalStore = globalThis as unknown as { __whatsappBookings?: Appointment[] };
const bookings: Appointment[] = (globalStore.__whatsappBookings ??= []);

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function parseIsoDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function workingWindow(staffId: string, date: string): { start: number; end: number } | null {
  const staff = mockStaff.find((s) => s.id === staffId);
  if (!staff) return null;
  const hours = staff.workingHours[IT_DAY_NAMES[parseIsoDate(date).getDay()]];
  if (!hours || hours.trim() === '-') return null;
  const [start, end] = hours.split('-').map((s) => toMinutes(s.trim()));
  return { start, end };
}

function busyIntervals(staffId: string, date: string): Array<[number, number]> {
  return [...mockAppointments, ...bookings]
    .filter((a) => a.staffId === staffId && a.date === date && a.status !== 'cancelled')
    .map((a) => {
      const start = toMinutes(a.startTime);
      return [start, start + a.durationMinutes + a.cleaningMinutes] as [number, number];
    });
}

function isFree(staffId: string, date: string, startTime: string, durationMinutes: number): boolean {
  const window = workingWindow(staffId, date);
  if (!window) return false;
  const start = toMinutes(startTime);
  const end = start + durationMinutes;
  if (start < window.start || end > window.end) return false;
  return busyIntervals(staffId, date).every(([bStart, bEnd]) => end <= bStart || start >= bEnd);
}

export const WhatsAppBookingStore = {
  list(): Appointment[] {
    return bookings;
  },

  bookableStaff() {
    return mockStaff.filter((s) => !s.isReceptionist);
  },

  /** Orari liberi per servizio e giorno, raggruppati per collaboratore */
  findFreeSlots({ serviceId, date, staffId }: { serviceId: string; date: string; staffId?: string }) {
    const service = mockServices.find((s) => s.id === serviceId);
    if (!service) return { error: `Servizio ${serviceId} inesistente` };

    const now = new Date();
    const staffList = this.bookableStaff().filter((s) => !staffId || s.id === staffId);

    return {
      service: service.name,
      durationMinutes: service.durationMinutes,
      date,
      staff: staffList.map((staff) => {
        const window = workingWindow(staff.id, date);
        const slots: string[] = [];
        if (window) {
          for (let t = window.start; t + service.durationMinutes <= window.end; t += SLOT_STEP_MINUTES) {
            const startTime = toHHMM(t);
            const slotDate = parseIsoDate(date);
            slotDate.setHours(Math.floor(t / 60), t % 60);
            if (slotDate > now && isFree(staff.id, date, startTime, service.durationMinutes)) {
              slots.push(startTime);
            }
          }
        }
        return { staffId: staff.id, staffName: `${staff.name} ${staff.surname}`, closed: !window, freeSlots: slots };
      }),
    };
  },

  /** Crea l'appuntamento solo se lo slot è ancora libero (niente overbooking) */
  createBooking({
    serviceId,
    staffId,
    date,
    startTime,
    clientName,
    clientPhone,
    notes,
  }: {
    serviceId: string;
    staffId: string;
    date: string;
    startTime: string;
    clientName: string;
    clientPhone: string;
    notes?: string;
  }): { success: true; appointment: Appointment } | { success: false; error: string } {
    const service = mockServices.find((s) => s.id === serviceId);
    const staff = mockStaff.find((s) => s.id === staffId);
    if (!service || !staff) return { success: false, error: 'Servizio o collaboratore inesistente' };
    if (!isFree(staffId, date, startTime, service.durationMinutes)) {
      return { success: false, error: 'Orario non più disponibile' };
    }

    const jsDate = parseIsoDate(date);
    const appointment: Appointment = {
      id: `wa-${Date.now()}`,
      clientId: `wa-cli-${clientPhone.replace(/\D/g, '')}`,
      clientName,
      clientPhone,
      clientEmail: '',
      hasPrivacyConsent: false,
      serviceId: service.id,
      serviceName: service.name,
      serviceShortname: service.shortname,
      serviceColor: service.categoryColor,
      staffId: staff.id,
      staffInitials: staff.initials,
      staffName: staff.name,
      date,
      dayOfWeek: `${AGENDA_DAY_NAMES[jsDate.getDay()]} ${jsDate.getDate()}`,
      startTime,
      durationFormatted: `${Math.floor(service.durationMinutes / 60)}.${String(service.durationMinutes % 60).padStart(2, '0')}h`,
      durationMinutes: service.durationMinutes,
      cleaningMinutes: 0,
      notes: notes ? `[WhatsApp] ${notes}` : '[Prenotato via WhatsApp]',
      feePercentage: 0,
      source: 'ONLINE',
      status: 'confirmed',
    };
    bookings.push(appointment);
    return { success: true, appointment };
  },

  /** Appuntamenti futuri di un numero di telefono */
  listForPhone(phone: string): Appointment[] {
    const digits = phone.replace(/\D/g, '');
    return bookings.filter((a) => a.clientPhone.replace(/\D/g, '') === digits && a.status !== 'cancelled');
  },

  cancelBooking(appointmentId: string, phone: string): boolean {
    const app = this.listForPhone(phone).find((a) => a.id === appointmentId);
    if (!app) return false;
    app.status = 'cancelled';
    return true;
  },
};
