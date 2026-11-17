import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resetSchema } from '@coachos/domain';
import { logAuth, redirectTo, sameOrigin } from '@/server/auth/forms';
import { supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/** Nouveau mot de passe, après le lien de réinitialisation (session de récupération). */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const parsed = resetSchema.safeParse({ password: String(form.get('password') ?? '') });
  if (!parsed.success) return redirectTo(req, '/reset-password', { error: 'weak' });
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return redirectTo(req, '/forgot-password', { error: 'expired' });
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logAuth(error.code ?? 'update_password_failed', error.status);
    return redirectTo(req, '/reset-password', { error: error.code === 'same_password' ? 'same' : 'weak' });
  }
  return redirectTo(req, '/profile', { notice: 'password' });
}
