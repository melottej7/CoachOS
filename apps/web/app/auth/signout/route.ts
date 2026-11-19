import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_COOKIE } from '@/server/auth/session';
import { supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/** Déconnexion : session Supabase et identité de démonstration. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== req.headers.get('host')) return new NextResponse(null, { status: 403 });
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  // Retour possible vers l’invitation (seule destination admise) : l’invitation reste mémorisée dans ce navigateur.
  const next = (await req.formData().catch(() => null))?.get('next');
  const to = next === '/invite' ? '/invite' : supabaseConfigured() ? '/login' : '/demo';
  const res = NextResponse.redirect(new URL(to, req.url), 303);
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
