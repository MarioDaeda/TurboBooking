import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { NextRequest, NextResponse } from 'next/server';
import { ServiceRepository } from '@/server/db/repositories';
import { apiError } from '@/server/http/api';

// Endpoint per la lettura server dei trattamenti / servizi reali da Supabase
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const services = await ServiceRepository.listActive();
    return NextResponse.json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    return apiError(error);
  }
}
