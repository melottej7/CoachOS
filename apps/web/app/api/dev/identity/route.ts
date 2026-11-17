import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_COOKIE, demoAuthEnabled } from '@/server/auth/session';
import { DEMO_IDENTITIES } from '@/server/db/fixtures';

/** Choix d’une identité fictive (développement uniquement). Formulaire HTML : POST same-origin. */
export async function POST(req: NextRequest) {
  if (!demoAuthEnabled()) return new NextResponse(null, { status: 404 });
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== req.headers.get('host')) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const userId = String(form.get('userId') ?? '');
  if (userId === '') {
    const out = NextResponse.redirect(new URL('/demo', req.url), 303);
    out.cookies.delete(DEMO_COOKIE);
    return out;
  }
  const res = NextResponse.redirect(new URL('/', req.url), 303);
  if (!DEMO_IDENTITIES.some((i) => i.userId === userId)) return new NextResponse(null, { status: 400 });
  res.cookies.set(DEMO_COOKIE, userId, { httpOnly: true, sameSite: 'lax', path: '/', secure: false });
  return res;
}
