import { NextRequest, NextResponse } from 'next/server';
import { CustomerRepository } from '@/server/db/repositories';
import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { apiError, isUuid, readBody } from '@/server/http/api';

export const dynamic = 'force-dynamic';

/** PATCH /api/v1/customers/:id — aggiorna nome, telefono ed email di un cliente esistente. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await context.params;
    const { firstName, lastName, phone, email } = await readBody(request);

    if (!isUuid(id) || typeof firstName !== 'string' || !firstName.trim()) throw new Error('TB_INVALID_REQUEST');
    for (const value of [lastName, phone, email]) {
      if (value !== undefined && value !== null && typeof value !== 'string') throw new Error('TB_INVALID_REQUEST');
    }
    const clean = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

    const customer = await CustomerRepository.update(id, {
      firstName: firstName.trim(),
      lastName: clean(lastName),
      phone: clean(phone),
      email: clean(email),
    });
    if (!customer) throw new Error('TB_CUSTOMER_NOT_FOUND');

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    return apiError(error);
  }
}
