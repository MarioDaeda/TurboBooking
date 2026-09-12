import { NextRequest, NextResponse } from 'next/server';
import { BookingRepository } from '@/server/db/repositories';
import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { apiError, isTimestamp, isUuid, readBody } from '@/server/http/api';
export const dynamic = 'force-dynamic';
type Action = 'confirm' | 'reschedule' | 'cancel' | 'complete' | 'no_show';
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id: bookingId } = await context.params;
    const { action, startAt, endAt, operatorId } = await readBody(request);
    if (!isUuid(bookingId) || typeof action !== 'string' || !['confirm', 'reschedule', 'cancel', 'complete', 'no_show'].includes(action)) throw new Error('TB_INVALID_REQUEST');
    if (action === 'reschedule') {
      if (!isTimestamp(startAt) || (endAt !== undefined && (!isTimestamp(endAt) || Date.parse(endAt) <= Date.parse(startAt))) ||
          (operatorId !== undefined && !isUuid(operatorId))) throw new Error('TB_INVALID_REQUEST');
    } else if (startAt !== undefined || endAt !== undefined || operatorId !== undefined) throw new Error('TB_INVALID_REQUEST');
    const booking = await BookingRepository.changeBooking({ bookingId, action: action as Action,
      startAt: startAt as string | undefined, endAt: endAt as string | undefined, operatorId: operatorId as string | undefined });
    return NextResponse.json({ success: true, booking });
  } catch (error) { return apiError(error); }
}
