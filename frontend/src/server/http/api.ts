import { NextResponse } from 'next/server';

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}
export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && isDate(value.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value));
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('TB_INVALID_REQUEST');
  return body;
}
export function errorStatus(error: unknown): number {
  const e = error as { message?: string; code?: string };
  const message = `${e?.code || ''} ${e?.message || ''}`;
  if (error instanceof SyntaxError) return 400;
  if (/TB_\w*NOT_FOUND|23503/.test(message)) return 404;
  if (/23P01|23505|bookings_no_operator_overlap|TB_(IDEMPOTENCY_MISMATCH|INVALID_STATE|HOLD_EXPIRED|OUTSIDE_WORKING_HOURS|BLOCKED_PERIOD|OPERATOR_UNAVAILABLE|SERVICE_INACTIVE|OPERATOR_MANUAL_ONLY|SERVICE_MANUAL_ONLY)/.test(message)) return 409;
  if (/22P02|22007|22008|23502|23514|TB_(INVALID_REQUEST|INVALID_ACTION|INVALID_INTERVAL|START_INVALID|DURATION_INVALID|MISSING_START|IDEMPOTENCY_REQUIRED)/.test(message)) return 400;
  return 500;
}
export function apiError(error: unknown) {
  const status = errorStatus(error);
  if (status === 500) console.error('API failure', error);
  return NextResponse.json({ error: status === 500 ? 'Errore interno del servizio.' :
    status === 404 ? 'Risorsa non trovata.' : status === 409 ? 'Conflitto di prenotazione o stato non consentito.' : 'Richiesta non valida.' }, { status });
}
