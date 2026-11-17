import { NextResponse, type NextRequest } from 'next/server';

/** Formulaire same-origin uniquement (protection CSRF des routes d’authentification). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  return Boolean(origin && new URL(origin).host === req.headers.get('host'));
}

/** Redirection 303 vers une page locale, sans aucune donnée personnelle dans l’URL. */
export function redirectTo(req: NextRequest, path: string, params: Record<string, string | undefined> = {}) {
  const url = new URL(path, req.url);
  for (const [k, v] of Object.entries(params)) if (v && !(k === 'next' && v === '/')) url.searchParams.set(k, v);
  return NextResponse.redirect(url, 303);
}

export function logAuth(code: string, status?: number) {
  console.warn(JSON.stringify({ module: 'auth', code, status }));
}
