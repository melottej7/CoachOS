import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { signUpSchema } from '@coachos/domain';
import { logAuth, redirectTo, sameOrigin } from '@/server/auth/forms';
import { clientIp, overLimit, waitMinutes } from '@/server/rate-limit';
import { safeNext, supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/** Inscription coach : nom, adresse, mot de passe. Compte actif immédiatement en local (D-020). */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const next = safeNext(String(form.get('next') ?? '/'));
  const wait = await overLimit('signup.ip', clientIp(req)); // D-162 : 5 inscriptions par heure et par connexion internet
  if (wait) {
    logAuth('rate_limited', 429);
    return redirectTo(req, '/signup', { error: 'rate', wait: waitMinutes(wait), next });
  }
  const parsed = signUpSchema.safeParse({
    firstName: String(form.get('firstName') ?? ''),
    lastName: String(form.get('lastName') ?? ''),
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  });
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === 'password');
    return redirectTo(req, '/signup', { error: weak ? 'weak' : 'fields', next });
  }
  const { displayName, email, password } = parsed.data;
  // D-114 · En ligne, Supabase demande de confirmer l’adresse : le lien reçu revient sur /auth/callback, qui ouvre
  // la session puis mène à la création de l’espace. Sans cette adresse de retour, le code de session serait perdu.
  const origin = new URL(req.headers.get('origin')!).origin;
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next === '/' ? '/coach/new' : next)}`;
  const { data, error } = await (await supabaseServer()).auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo } });
  if (error) {
    logAuth(error.code ?? 'signup_failed', error.status);
    if (error.status === 429) return redirectTo(req, '/signup', { error: 'rate', next });
    if (error.code === 'weak_password') return redirectTo(req, '/signup', { error: 'weak', next });
    if (error.code === 'user_already_exists' || error.code === 'email_exists') return redirectTo(req, '/signup', { error: 'exists', next });
    return redirectTo(req, '/signup', { error: 'failed', next });
  }
  // Confirmation d’adresse désactivée en local : la session est ouverte tout de suite.
  if (!data.session) return redirectTo(req, '/login', { notice: 'confirm', next });
  return redirectTo(req, next === '/' ? '/coach/new' : next);
}
