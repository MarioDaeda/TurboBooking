import { NextRequest, NextResponse } from 'next/server';
import { BookingRepository } from '@/server/db/repositories';
import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { apiError, isTimestamp, isUuid, readBody } from '@/server/http/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const params = request.nextUrl.searchParams;
    const startAt = params.get('startAt'), endAt = params.get('endAt');
    const operatorId = params.get('operatorId') ?? undefined;
    if (!isTimestamp(startAt) || !isTimestamp(endAt) || Date.parse(endAt) <= Date.parse(startAt) ||
        (operatorId !== undefined && !isUuid(operatorId))) throw new Error('TB_INVALID_REQUEST');
    const bookings = await BookingRepository.listByDateRange({ startAt, endAt, operatorId });
    return NextResponse.json({ success: true, total: bookings.length, bookings });
  } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { customerId, operatorId, serviceId, startAt, notes, idempotencyKey } = await readBody(request);
    if (!isUuid(customerId) || !isUuid(operatorId) || !isUuid(serviceId) || !isTimestamp(startAt) ||
        typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 200 ||
        (notes !== undefined && notes !== null && typeof notes !== 'string')) throw new Error('TB_INVALID_REQUEST');
    const booking = await BookingRepository.createBooking({ customerId, operatorId, serviceId, startAt,
      source: 'dashboard', notes: notes as string | null | undefined, idempotencyKey });
    return NextResponse.json({ success: true, booking }, { status: 201 });
  } catch (error) { return apiError(error); }
}
