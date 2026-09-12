import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getSupabaseAdminClient, OperatorRow } from '../db/supabaseClient';
import { isUuid } from '../http/api';

export type AuthResult =
  | { authorized: true; operator: OperatorRow; authMethod: 'supabase_jwt' | 'internal_secret'; userId?: string }
  | { authorized: false; status: 401 | 403; error: string };

export async function verifyStaffAuthorization(request: NextRequest): Promise<AuthResult> {
  const header = request.headers.get('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const token = header ? bearer : request.cookies.get('tb_staff_token')?.value;
  if (!token) return { authorized: false, status: 401, error: 'Autenticazione richiesta.' };
  if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== request.nextUrl.origin) {
    return { authorized: false, status: 403, error: 'Origine non valida.' };
  }
  const supabase = getSupabaseAdminClient();
  const secret = process.env.INTERNAL_API_SECRET || process.env.DASHBOARD_STAFF_SECRET;
  // Internal credentials are accepted only as an explicit bearer token, never as cookies.
  if (bearer && secret && Buffer.byteLength(token) === Buffer.byteLength(secret) &&
      timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
    const operatorId = request.headers.get('x-operator-id');
    if (!isUuid(operatorId)) return { authorized: false, status: 403, error: 'Operatore di sistema richiesto.' };
    const { data, error } = await supabase.from('operators').select('*').eq('id', operatorId).eq('active', true).maybeSingle();
    if (error) throw error;
    if (!data) return { authorized: false, status: 403, error: 'Operatore non autorizzato.' };
    return { authorized: true, operator: data, authMethod: 'internal_secret' };
  }
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) return { authorized: false, status: 401, error: 'Sessione non valida o scaduta.' };
  // Explicit, administrator-managed mapping. No email, metadata or first-operator fallback.
  const { data: membership, error: memberError } = await supabase.from('staff_memberships')
    .select('operator_id').eq('user_id', userData.user.id).eq('active', true).maybeSingle();
  if (memberError) throw memberError;
  if (!membership) return { authorized: false, status: 403, error: 'Utente non abilitato allo staff.' };
  const { data: operator, error } = await supabase.from('operators').select('*')
    .eq('id', membership.operator_id).eq('active', true).maybeSingle();
  if (error) throw error;
  if (!operator) return { authorized: false, status: 403, error: 'Operatore non attivo.' };
  return { authorized: true, operator, authMethod: 'supabase_jwt', userId: userData.user.id };
}
