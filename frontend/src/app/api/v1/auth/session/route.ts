import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyStaffAuthorization } from '@/server/auth/staffAuth';
import { apiError, readBody } from '@/server/http/api';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffAuthorization(request);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    return NextResponse.json({ success: true, operator: auth.operator }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Origine non valida.' }, { status: 403 });
    const { email, password } = await readBody(request);
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) throw new Error('TB_INVALID_REQUEST');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Configurazione Supabase Auth mancante');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) return NextResponse.json({ error: 'Credenziali non valide.' }, { status: 401 });
    const check = new NextRequest(request.url, { headers: { authorization: `Bearer ${data.session.access_token}` } });
    const auth = await verifyStaffAuthorization(check);
    if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('tb_staff_token', data.session.access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/',
      maxAge: data.session.expires_in,
    });
    return response;
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Origine non valida.' }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.cookies.delete('tb_staff_token');
  return response;
}
