import { NextRequest, NextResponse } from 'next/server';
import { AvailabilityService } from '@/server/domain/booking/availabilityService';
import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { apiError, isDate, isUuid } from '@/server/http/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const params = request.nextUrl.searchParams;
    const serviceId = params.get('serviceId');
    const date = params.get('date') ?? undefined;
    const operatorId = params.get('operatorId') ?? params.get('staffId') ?? undefined;
    const granularity = Number(params.get('granularity') ?? 15);
    if (!isUuid(serviceId) || (date !== undefined && !isDate(date)) ||
        (operatorId !== undefined && !isUuid(operatorId)) || !Number.isInteger(granularity) || granularity < 5 || granularity > 120) {
      throw new Error('TB_INVALID_REQUEST');
    }
    const slots = await AvailabilityService.findAvailableSlots({ serviceId, targetDate: date, preferredStaffId: operatorId, granularityMinutes: granularity });
    return NextResponse.json({ success: true, date: date ?? 'today', serviceId, totalSlots: slots.length, slots });
  } catch (error) { return apiError(error); }
}
