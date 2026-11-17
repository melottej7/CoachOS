import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { forgotSchema } from '@coachos/domain';
import { logAuth, redirectTo, sameOrigin } from '@/server/auth/forms';
import { supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/** Mot de passe oublié (C02-06) : même réponse pour une adresse connue ou inconnue. */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const parsed = forgotSchema.safeParse({ email: String(form.get('email') ?? '') });
  if (!parsed.success) return redirectTo(req, '/forgot-password', { error: 'email' });
  const origin = new URL(req.headers.get('origin')!).origin;
  const { error } = await (await supabaseServer()).auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });
  if (error) {
    logAuth(error.code ?? 'recovery_failed', error.status);
    if (error.status === 429) return redirectTo(req, '/forgot-password', { error: 'rate' });
  }
  return redirectTo(req, '/forgot-password', { sent: '1' });
}
