import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { NextRequest, NextResponse } from 'next/server';
import { CustomerRepository } from '@/server/db/repositories';
import { apiError, readBody } from '@/server/http/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/customers
 * Ricerca clienti per nome, cognome o telefono, oppure restituisce i clienti recenti.
 * NON seleziona mai silenziosamente il primo risultato se ci sono più record con lo stesso numero.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    const customers = query
      ? await CustomerRepository.search(query)
      : await CustomerRepository.listRecent(50);

    return NextResponse.json({
      success: true,
      total: customers.length,
      customers,
    });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/v1/customers
 * Crea un nuovo cliente in Supabase.
 * Supporta telefono nullable o duplicato (il telefono non è vincolato a univocità).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await readBody(request);
    const { firstName, lastName, phone, email, notes, privacyConsent, marketingConsent } = body;

    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      throw new Error('TB_INVALID_REQUEST');
    }
    for (const value of [lastName, phone, email, notes]) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        throw new Error('TB_INVALID_REQUEST');
      }
    }
    for (const value of [privacyConsent, marketingConsent]) {
      if (value !== undefined && typeof value !== 'boolean') throw new Error('TB_INVALID_REQUEST');
    }

    const customer = await CustomerRepository.create({
      firstName: firstName.trim(),
      lastName: typeof lastName === 'string' ? lastName.trim() : null,
      phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
      email: typeof email === 'string' && email.trim() ? email.trim() : null,
      notes: typeof notes === 'string' ? notes.trim() : null,
      privacyConsent: privacyConsent as boolean | undefined,
      marketingConsent: marketingConsent as boolean | undefined,
    });

    return NextResponse.json(
      {
        success: true,
        customer,
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error);
  }
}
