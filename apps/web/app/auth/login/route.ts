import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { signInSchema } from '@coachos/domain';
import { logAuth, redirectTo, sameOrigin } from '@/server/auth/forms';
import { clientIp, overLimit, waitMinutes } from '@/server/rate-limit';
import { safeNext, supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/**
 * Connexion par adresse et mot de passe (D-020). Message d’échec unique : ne révèle pas si le compte existe.
 * D-162 : 30 tentatives par connexion internet et 10 échecs par compte, par quart d’heure.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const next = safeNext(String(form.get('next') ?? '/'));
  const ipWait = await overLimit('login.ip', clientIp(req));
  if (ipWait) return limited(req, ipWait, next);
  const parsed = signInSchema.safeParse({ email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') });
  if (!parsed.success) return redirectTo(req, '/login', { error: 'credentials', next });
  const accountWait = await overLimit('login.email', parsed.data.email, { count: false });
  if (accountWait) return limited(req, accountWait, next);

  const { error } = await (await supabaseServer()).auth.signInWithPassword(parsed.data);
  if (error) {
    logAuth(error.code ?? 'signin_failed', error.status);
    if (error.status === 429) return redirectTo(req, '/login', { error: 'rate', next });
    await overLimit('login.email', parsed.data.email); // un échec de plus sur ce compte, connu ou non
    return redirectTo(req, '/login', { error: 'credentials', next });
  }
  return redirectTo(req, next === '/' ? '/choose-workspace' : next);
}

function limited(req: NextRequest, seconds: number, next: string) {
  logAuth('rate_limited', 429);
  return redirectTo(req, '/login', { error: 'rate', wait: waitMinutes(seconds), next });
}
