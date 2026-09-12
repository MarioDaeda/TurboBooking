import { DaySchedule } from '@/types';

export interface AgendaDay {
  key: string;
  name: string;
  date: string;
  isoDate: string; // YYYY-MM-DD
  isClosed: boolean;
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
  isOverridden?: boolean;
}

export const defaultSalonHours: DaySchedule[] = [
  { day: 'Domenica', shortName: 'DOM', hours: 'Chiuso', isOpen: false, openTime: '08:00', closeTime: '19:00' },
  { day: 'Lunedì', shortName: 'LUN', hours: 'Chiuso', isOpen: false, openTime: '08:00', closeTime: '19:00' },
  { day: 'Martedì', shortName: 'MAR', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
  { day: 'Mercoledì', shortName: 'MER', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
  { day: 'Giovedì', shortName: 'GIO', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
  { day: 'Venerdì', shortName: 'VEN', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
  { day: 'Sabato', shortName: 'SAB', hours: '08:00 - 18:00', isOpen: true, openTime: '08:00', closeTime: '18:00' },
];

export const DAY_NAMES = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

/**
 * Calcola i 7 giorni (da Lunedì a Domenica) della settimana contenente la data specificata.
 */
export function getWeekDays(anchorDate: Date = new Date()): AgendaDay[] {
  const dayOfWeek = anchorDate.getDay(); // 0 = Dom, 1 = Lun, ...
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(anchorDate);
  monday.setDate(anchorDate.getDate() + distanceToMonday);

  return DAY_NAMES.map((name, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const isoDate = `${year}-${monthNum}-${dayNum}`;
    const key = `${name} ${dayNum}`;

    return {
      key,
      name,
      date: dayNum,
      isoDate,
      isClosed: idx === 0 || idx === 6, // Lunedì e Domenica chiusi di default
      isOpen: idx !== 0 && idx !== 6,
      openTime: idx === 5 ? '08:00' : '07:00',
      closeTime: idx === 5 ? '18:00' : '20:00',
    };
  });
}

// Settimana corrente calcolata dinamicamente
export const AGENDA_DAYS: AgendaDay[] = getWeekDays(new Date());

export function getTodayIndex(): number {
  const jsDay = new Date().getDay(); // 0 = Domenica, 1 = Lunedì, ...
  return jsDay === 0 ? 6 : jsDay - 1; // rimappa su indice LUN..DOM
}

export function getTodayDayKey(): string {
  const days = getWeekDays(new Date());
  return days[getTodayIndex()].key;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}
