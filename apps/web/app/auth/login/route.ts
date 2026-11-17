import { NextResponse, type NextRequest } from 'next/server';
import { safeNext, supabaseConfigured, supabaseServer } from '@/server/supabase/server';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Envoie le lien magique. Formulaire same-origin ; redirection 303 sans donnée personnelle dans l’URL. */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== req.headers.get('host')) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const next = safeNext(String(form.get('next') ?? '/'));
  const back = (q: string) => NextResponse.redirect(new URL(`/login?${q}${next !== '/' ? `&next=${encodeURIComponent(next)}` : ''}`, req.url), 303);
  if (!EMAIL.test(email) || email.length > 254) return back('error=email');

  const supabase = await supabaseServer();
  const callback = new URL('/auth/callback', origin);
  if (next !== '/') callback.searchParams.set('next', next);
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString(), shouldCreateUser: true } });
  if (error) {
    console.warn(JSON.stringify({ module: 'auth', code: error.code ?? 'otp_failed', status: error.status }));
    if (error.status === 429) return back('error=rate');
    return back('error=send');
  }
  return back('sent=1');
}
