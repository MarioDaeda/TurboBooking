import type { Appointment } from '@/types';
import { romeLocalToUtc } from './romeTime';

/** Existing bookings must use the mutation API, never the creation endpoint. */
export function bookingSaveRequest(app: Appointment, previous: Appointment | undefined, idempotencyKey: string) {
  const startAt = romeLocalToUtc(app.date!, app.startTime).toISOString();
  if (previous) {
    // Nome, telefono ed email si aggiornano sulla scheda cliente, non sulla prenotazione.
    if (app.clientId !== previous.clientId || app.serviceId !== previous.serviceId ||
        (app.notes || '') !== (previous.notes || '') ||
        app.hasPrivacyConsent !== previous.hasPrivacyConsent) {
      throw new Error('Da questa finestra puoi modificare operatore, durata e dati di contatto del cliente. Le modifiche a servizio, note e consenso privacy non sono ancora supportate.');
    }
    return {
      url: `/api/v1/bookings/${previous.id}`,
      method: 'PATCH',
      body: {
        action: 'reschedule', startAt, operatorId: app.staffId,
        ...(app.durationMinutes !== previous.durationMinutes
          ? { endAt: new Date(Date.parse(startAt) + app.durationMinutes * 60000).toISOString() } : {}),
      },
    };
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(app.id)) {
    throw new Error('Appuntamento non più presente in agenda. Ricarica prima di modificarlo.');
  }
  return {
    url: '/api/v1/bookings', method: 'POST',
    body: { idempotencyKey, customerId: app.clientId, operatorId: app.staffId,
      serviceId: app.serviceId, startAt, notes: app.notes || null },
  };
}
