import { NextResponse, type NextRequest } from 'next/server';
import { CONFIRM_TYPES, type ConfirmType } from '@/server/auth/recovery';
import { safeNext, supabaseServer } from '@/server/supabase/server';

/**
 * Lien d’e-mail vérifié par le serveur (`token_hash`), sans secret gardé par le navigateur : il marche même ouvert dans
 * Safari alors que la demande venait de l’app installée (bilan produit, iPhone). `/auth/callback` (PKCE) reste en place.
 */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as ConfirmType | null;
  const fallback = type === 'recovery' ? '/reset-password' : '/choose-workspace';
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const fail = NextResponse.redirect(new URL(type === 'recovery' ? '/forgot-password?error=expired' : '/login?error=link', req.url), 303);
  if (!tokenHash || !type || !CONFIRM_TYPES.includes(type)) return fail;
  const { error } = await (await supabaseServer()).auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    console.warn(JSON.stringify({ module: 'auth', code: error.code ?? 'confirm_failed' }));
    return fail;
  }
  return NextResponse.redirect(new URL(next === '/' ? fallback : next, req.url), 303);
}
