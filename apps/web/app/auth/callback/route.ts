import { NextResponse, type NextRequest } from 'next/server';
import { safeNext, supabaseServer } from '@/server/supabase/server';

/** X03 : finaliser l’identification (échange du code PKCE contre une session), puis destination locale. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const fail = NextResponse.redirect(new URL(`/login?error=link${next !== '/' ? `&next=${encodeURIComponent(next)}` : ''}`, req.url), 303);
  if (!code) return fail;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn(JSON.stringify({ module: 'auth', code: error.code ?? 'exchange_failed' }));
    return fail;
  }
  return NextResponse.redirect(new URL(next === '/' ? '/choose-workspace' : next, req.url), 303);
}
