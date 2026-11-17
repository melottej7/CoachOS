import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_COOKIE } from '@/server/auth/session';
import { supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/** Déconnexion : session Supabase et identité de démonstration. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== req.headers.get('host')) return new NextResponse(null, { status: 403 });
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  const res = NextResponse.redirect(new URL(supabaseConfigured() ? '/login' : '/demo', req.url), 303);
  res.cookies.delete(DEMO_COOKIE);
  return res;
}
