import { createHmac } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getDb } from './db/client';
import { AppError } from './errors';

/**
 * D-162 · Limitation des abus sur les routes publiques.
 * Fenêtres fixes comptées en base (`private.rate_hits`), car sur Vercel chaque requête peut tomber sur une instance
 * différente, et Supabase Auth voit l’adresse du serveur, pas celle du visiteur.
 * Les valeurs sont des réglages : les changer ne demande ni migration ni autre code.
 */
export const LIMITS = {
  'login.ip': { max: 30, windowS: 15 * 60 }, // toutes les tentatives d’une même connexion internet (club, bureau)
  'login.email': { max: 10, windowS: 15 * 60 }, // échecs sur un même compte, d’où qu’ils viennent
  'signup.ip': { max: 5, windowS: 60 * 60 },
  'forgot.ip': { max: 10, windowS: 60 * 60 },
  'forgot.email': { max: 3, windowS: 60 * 60 }, // personne ne reçoit plus de trois liens par heure
  'reset.ip': { max: 10, windowS: 15 * 60 },
  'invite.ip': { max: 10, windowS: 60 * 60 }, // comptes élèves créés depuis une invitation
  'preview.ip': { max: 60, windowS: 10 * 60 }, // présentation de l’espace qui invite
} as const satisfies Record<string, { max: number; windowS: number }>;
export type Bucket = keyof typeof LIMITS;

/** Adresse du visiteur. Sur Vercel, `x-real-ip` et `x-forwarded-for` sont posés par la plateforme, jamais repris du client. */
export function clientIp(req: Pick<NextRequest, 'headers'>): string {
  return req.headers.get('x-real-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'inconnue';
}

/** Empreinte non réversible sans la clé du serveur : ni adresse IP ni e-mail n’est gardé en clair. */
function fingerprint(bucket: Bucket, value: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || 'coachos-local';
  return createHmac('sha256', pepper).update(`${bucket}:${value.trim().toLowerCase()}`).digest('base64url').slice(0, 32);
}

let warned = false;

/**
 * Compte une tentative (sauf `count: false`, qui ne fait que regarder) et dit s’il faut refuser.
 * Renvoie le nombre de secondes à attendre si la limite est dépassée, sinon null.
 * Si la base ne répond pas, on laisse passer : la connexion ne doit jamais dépendre de ce garde-fou.
 */
export async function overLimit(bucket: Bucket, value: string, opts: { count?: boolean } = {}): Promise<number | null> {
  const { max, windowS } = LIMITS[bucket];
  const key = fingerprint(bucket, value);
  try {
    const db = await getDb();
    const window = `to_timestamp(floor(extract(epoch from statement_timestamp()) / $3::int) * $3::int)`;
    const r = opts.count === false
      ? await db.query<{ hits: number; retry: number }>(
        `select hits, ceil(extract(epoch from (window_start + make_interval(secs => $3::int) - statement_timestamp())))::int as retry
         from private.rate_hits where bucket = $1 and key_hash = $2 and window_start = ${window}`, [bucket, key, windowS])
      : await db.query<{ hits: number; retry: number }>(
        `insert into private.rate_hits (bucket, key_hash, window_start) values ($1, $2, ${window})
         on conflict (bucket, key_hash, window_start) do update set hits = private.rate_hits.hits + 1
         returning hits, ceil(extract(epoch from (window_start + make_interval(secs => $3::int) - statement_timestamp())))::int as retry`,
        [bucket, key, windowS]);
    if (Math.random() < 0.02) await db.query(`delete from private.rate_hits where window_start < now() - interval '2 days'`);
    const row = r.rows[0];
    if (!row) return null;
    const over = opts.count === false ? row.hits >= max : row.hits > max;
    return over ? Math.max(1, row.retry) : null;
  } catch {
    if (!warned) console.error(JSON.stringify({ module: 'rate', code: 'RATE_LIMIT_UNAVAILABLE' }));
    warned = true;
    return null;
  }
}

/** Minutes à afficher (arrondi au-dessus, au moins 1). */
export const waitMinutes = (seconds: number) => String(Math.max(1, Math.ceil(seconds / 60)));

/** Phrase montrée au visiteur, avec le temps d’attente réel. */
export function waitSentence(minutes: string | number | undefined): string | null {
  const n = Number(minutes);
  if (!Number.isInteger(n) || n < 1 || n > 120) return null;
  return `Trop de tentatives rapprochées. Réessaie dans ${n} minute${n > 1 ? 's' : ''}.`;
}

/** Erreur 429 des routes JSON (invitation) ; la route ajoute l’en-tête Retry-After. */
export const rateLimited = (seconds: number) =>
  new AppError('RATE_LIMITED', waitSentence(waitMinutes(seconds))!, null, { retryAfter: seconds });
