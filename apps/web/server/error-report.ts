/**
 * D-168 · Suivi des erreurs en production, éteint tant que `SENTRY_DSN` n’est pas réglé.
 *
 * Pas de bibliothèque : un seul envoi HTTP vers l’adresse « envelope » de Sentry. Ce qui part : le type d’erreur,
 * un message nettoyé (adresses, identifiants, nombres et textes entre guillemets masqués), la pile d’appels, le module,
 * le code, la référence (digest, celle affichée sur « Un problème est survenu ») et le gabarit de route
 * (`/coach/athletes/[id]`, jamais l’adresse réelle). Ce qui ne part jamais : en-têtes, cookies, corps, identité.
 */

type Dsn = { endpoint: string; publicKey: string; raw: string };

export type ErrorContext = {
  module: string;
  code?: string;
  digest?: string;
  requestId?: string;
  route?: string;
  kind?: string;
};

export function parseDsn(value: string | undefined): Dsn | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    const projectId = url.pathname.split('/').filter(Boolean).pop();
    if (!/^https?:$/.test(url.protocol) || !url.username || !projectId || !/^\d+$/.test(projectId)) return null;
    const prefix = url.pathname.slice(0, url.pathname.lastIndexOf('/'));
    return { endpoint: `${url.protocol}//${url.host}${prefix}/api/${projectId}/envelope/`, publicKey: url.username, raw: value.trim() };
  } catch {
    return null;
  }
}

export function errorReportingEnabled(): boolean {
  return parseDsn(process.env.SENTRY_DSN) !== null;
}

/** Masque ce qui pourrait identifier une personne ou une donnée : le message garde sa forme, pas son contenu. */
export function scrub(text: string): string {
  return text
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi, '<adresse>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/"[^"]*"|«[^»]*»|'[^'\s][^']*'/g, '<texte>')
    .replace(/\b\d[\d.,:-]*\b/g, '<n>')
    .slice(0, 300);
}

function frames(stack: string | undefined) {
  if (!stack) return undefined;
  const lines = stack.split('\n').slice(1, 31);
  const parsed = lines
    .map((line) => line.trim().match(/^at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({ function: m[1] ?? '?', filename: (m[2] ?? '?').replace(/^.*?\/(?=node_modules\/|\.next[^/]*\/|apps\/|server\/|app\/)/, ''), lineno: Number(m[3]), colno: Number(m[4]), in_app: !(m[2] ?? '').includes('node_modules') }));
  // Sentry attend la pile du plus ancien appel au plus récent.
  return parsed.length ? { frames: parsed.reverse() } : undefined;
}

export function buildEnvelope(dsn: Dsn, error: unknown, ctx: ErrorContext, now = new Date()): { eventId: string; body: string } {
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const err = error instanceof Error ? error : null;
  const tags: Record<string, string> = { module: ctx.module };
  if (ctx.code) tags.code = ctx.code;
  if (ctx.digest) tags.digest = ctx.digest;
  if (ctx.requestId) tags.reqId = ctx.requestId;
  if (ctx.kind) tags.kind = ctx.kind;
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: 'node',
    level: 'error',
    logger: 'coachos',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12),
    transaction: ctx.route,
    tags,
    exception: {
      values: [{ type: err?.name || 'Error', value: scrub(err?.message ?? String(error)), stacktrace: frames(err?.stack) }],
    },
  };
  const header = { event_id: eventId, sent_at: now.toISOString(), dsn: dsn.raw };
  const body = `${JSON.stringify(header)}\n${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
  return { eventId, body };
}

/**
 * Envoie l’erreur si le suivi est réglé ; ne lève jamais et ne bloque pas plus de 2 s.
 * Renvoie l’identifiant de l’envoi, ou null (suivi éteint, envoi refusé ou impossible).
 */
export async function reportError(error: unknown, ctx: ErrorContext): Promise<string | null> {
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return null;
  try {
    const { eventId, body } = buildEnvelope(dsn, error, ctx);
    const res = await fetch(dsn.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-sentry-envelope',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=coachos/1.0`,
      },
      body,
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ module: 'errors', code: 'REPORT_REFUSED', status: res.status }));
      return null;
    }
    return eventId;
  } catch (e) {
    console.error(JSON.stringify({ module: 'errors', code: 'REPORT_FAILED', error: (e as Error)?.name }));
    return null;
  }
}
