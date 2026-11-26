import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { forgotSchema } from '@coachos/domain';
import { logAuth, redirectTo, sameOrigin } from '@/server/auth/forms';
import { clientIp, overLimit, waitMinutes } from '@/server/rate-limit';
import { supabaseConfigured, supabaseServer } from '@/server/supabase/server';
import { RECOVERY_EMAIL_COOKIE } from '@/server/auth/recovery';

/** Mot de passe oublié (C02-06) : même réponse pour une adresse connue ou inconnue. */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  // D-162 : 10 demandes par heure et par connexion internet, 3 liens par heure et par adresse (qu’un compte existe ou non).
  const ipWait = await overLimit('forgot.ip', clientIp(req));
  if (ipWait) return limited(req, ipWait);
  const parsed = forgotSchema.safeParse({ email: String(form.get('email') ?? '') });
  if (!parsed.success) return redirectTo(req, '/forgot-password', { error: 'email' });
  const emailWait = await overLimit('forgot.email', parsed.data.email);
  if (emailWait) return limited(req, emailWait);
  const origin = new URL(req.headers.get('origin')!).origin;
  const { error } = await (await supabaseServer()).auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });
  if (error) {
    logAuth(error.code ?? 'recovery_failed', error.status);
    if (error.status === 429) return redirectTo(req, '/forgot-password', { error: 'rate' });
  }
  // Fluidité (bilan produit) : l’adresse est gardée une heure dans un cookie du seul appareil qui a fait la demande, pour
  // que la saisie du code (recopié de l’e-mail) ne la redemande pas ; jamais dans l’adresse de la page.
  const res = redirectTo(req, '/forgot-password', { sent: '1' });
  res.cookies.set(RECOVERY_EMAIL_COOKIE, parsed.data.email, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 3600 });
  return res;
}

function limited(req: NextRequest, seconds: number) {
  logAuth('rate_limited', 429);
  return redirectTo(req, '/forgot-password', { error: 'rate', wait: waitMinutes(seconds) });
}
