export type SectionId =
  | 'agenda'
  | 'cassa'
  | 'rubrica'
  | 'promozioni'
  | 'masterclass'
  | 'magazzino-prodotti'
  | 'magazzino-ordini'
  | 'magazzino-scadenzario'
  | 'comunicazioni'
  | 'staff'
  | 'spese'
  | 'orari'
  | 'orari-aperture'
  | 'orari-chiusure'
  | 'trattamenti'
  | 'postazioni'
  | 'fornitori'
  | 'produttori'
  | 'spedizioni'
  | 'statistiche-andamento'
  | 'statistiche-azienda'
  | 'statistiche-corrispettivi'
  | 'statistiche-collaboratori'
  | 'statistiche-clienti'
  | 'statistiche-magazzino'
  | 'statistiche-inventario'
  | 'recensioni'
  | 'profilo'
  | 'profilo-fatturazione'
  | 'profilo-impostazioni'
  | 'profilo-vetrina'
  | 'profilo-utenti';

export interface Venue {
  id: string;
  name: string;
  shortname: string;
  legalName: string;
  address: string;
  zipCity: string;
  phone: string;
  email: string;
  piva: string;
  iban: string;
  cf?: string;
  active: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  surname: string;
  role: 'Titolare' | 'Collaboratore' | 'Receptionist';
  isReceptionist: boolean;
  avatar?: string;
  initials: string;
  utilizationPercentage: number;
  commissionPercentage: number;
  phone: string;
  email: string;
  workingHours: {
    [day: string]: string; // e.g. "07:00 - 20:00" or "-"
  };
  vacations: Array<{
    id: string;
    date: string;
    hours: string;
  }>;
  activeServiceIds: string[];
}

export interface ServiceItem {
  id: string;
  name: string;
  shortname: string;
  category: string;
  categoryColor: string;
  price: number;
  duration: string; // e.g. "01:00"
  durationMinutes: number;
  posaDuration?: string;
  posaMinutes?: number;
  sanificazione: boolean;
  hasVariants: boolean;
  isQuickChoice: boolean;
  isOnline: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  hasPrivacyConsent: boolean;
  notes?: string;
  totalVisits: number;
  lastVisit?: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  hasPrivacyConsent: boolean;
  serviceId: string;
  serviceName: string;
  serviceShortname: string;
  serviceColor: string;
  staffId: string;
  staffInitials: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string; // "LUN 31", "MAR 1", etc.
  startTime: string; // e.g. "08:00"
  durationFormatted: string; // e.g. "1.15h"
  durationMinutes: number;
  cleaningMinutes: number;
  notes?: string;
  feePercentage: number;
  source: 'DIRECT' | 'ONLINE' | 'TREATWELL';
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
}

export interface Review {
  id: string;
  clientName: string;
  date: string;
  appointmentDate: string;
  rating: number;
  comment: string;
  reply?: string;
  staffName: string;
  treatmentName: string;
  treatmentRating: number;
  atmosphereRating: number;
  cleanlinessRating: number;
  staffRating: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending';
}

export interface CorrispettivoRow {
  gg: string;
  impLordo: number;
  impNetto: number;
  impServizi: number;
  impRivendita: number;
  impPromozioni: number;
  impFatture: number;
  numRicevute: number;
}
