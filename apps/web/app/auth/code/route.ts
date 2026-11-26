import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { forgotSchema } from '@coachos/domain';
import { logAuth, redirectTo, sameOrigin } from '@/server/auth/forms';
import { normalizeCode, RECOVERY_EMAIL_COOKIE } from '@/server/auth/recovery';
import { clientIp, overLimit, waitMinutes } from '@/server/rate-limit';
import { supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/**
 * Code à 6 chiffres de « Mot de passe oublié » : ouvre la session dans l’appareil où il est saisi (l’app installée
 * sur iPhone comprise), puis mène au choix du nouveau mot de passe. Limité par connexion et par adresse.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const ipWait = await overLimit('code.ip', clientIp(req));
  if (ipWait) return redirectTo(req, '/forgot-password', { sent: '1', error: 'rate', wait: waitMinutes(ipWait) });
  const email = forgotSchema.safeParse({ email: String(form.get('email') ?? req.cookies.get(RECOVERY_EMAIL_COOKIE)?.value ?? '') });
  const code = normalizeCode(String(form.get('code') ?? ''));
  if (!email.success) return redirectTo(req, '/forgot-password', { error: 'email' });
  if (!code) return redirectTo(req, '/forgot-password', { sent: '1', error: 'code' });
  const emailWait = await overLimit('code.email', email.data.email, { count: false });
  if (emailWait) return redirectTo(req, '/forgot-password', { sent: '1', error: 'rate', wait: waitMinutes(emailWait) });

  const { error } = await (await supabaseServer()).auth.verifyOtp({ email: email.data.email, token: code, type: 'recovery' });
  if (error) {
    logAuth(error.code ?? 'otp_failed', error.status);
    await overLimit('code.email', email.data.email); // un code faux de plus pour cette adresse
    return redirectTo(req, '/forgot-password', { sent: '1', error: error.status === 429 ? 'rate' : 'code' });
  }
  const res = redirectTo(req, '/reset-password');
  res.cookies.delete(RECOVERY_EMAIL_COOKIE);
  return res;
}
