import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { signInSchema } from '@coachos/domain';
import { logAuth, redirectTo, sameOrigin } from '@/server/auth/forms';
import { safeNext, supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/** Connexion par adresse et mot de passe (D-020). Message d’échec unique : ne révèle pas si le compte existe. */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const next = safeNext(String(form.get('next') ?? '/'));
  const parsed = signInSchema.safeParse({ email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') });
  if (!parsed.success) return redirectTo(req, '/login', { error: 'credentials', next });

  const { error } = await (await supabaseServer()).auth.signInWithPassword(parsed.data);
  if (error) {
    logAuth(error.code ?? 'signin_failed', error.status);
    if (error.status === 429) return redirectTo(req, '/login', { error: 'rate', next });
    return redirectTo(req, '/login', { error: 'credentials', next });
  }
  return redirectTo(req, next === '/' ? '/choose-workspace' : next);
}
