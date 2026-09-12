import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { apiError } from '@/server/http/api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    return NextResponse.json({ error: 'Usare GET /api/v1/bookings per il calendario persistente.' }, { status: 410 });
  } catch (error) { return apiError(error); }
}
