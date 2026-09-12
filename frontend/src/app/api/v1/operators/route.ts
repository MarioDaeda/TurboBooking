import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { NextRequest, NextResponse } from 'next/server';
import { OperatorRepository } from '@/server/db/repositories';
import { apiError } from '@/server/http/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/operators
 * Restituisce l'elenco degli operatori attivi (Gianluca Tadonio, Sara Tadonio con UUID reali).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const operators = await OperatorRepository.listActive();
    return NextResponse.json({
      success: true,
      count: operators.length,
      operators,
    });
  } catch (error) {
    return apiError(error);
  }
}
