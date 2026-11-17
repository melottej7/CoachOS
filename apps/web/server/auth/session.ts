import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../db/client';

/**
 * Identité de démonstration (tranches A et B). Remplacée par Supabase Auth en tranche C.
 * Active seulement si COACHOS_DEMO_AUTH=1 et hors production : aucune vraie donnée derrière.
 */
export const DEMO_COOKIE = 'coachos_demo_identity';

export function demoAuthEnabled(): boolean {
  return process.env.COACHOS_DEMO_AUTH === '1' && process.env.NODE_ENV !== 'production';
}

export interface Actor {
  userId: string;
  displayName: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function getActor(): Promise<Actor | null> {
  // Lire la requête d’abord : toute page privée reste rendue dynamiquement, même sans démo.
  const value = (await cookies()).get(DEMO_COOKIE)?.value;
  if (!demoAuthEnabled()) return null;
  if (!value || !UUID.test(value)) return null;
  const db = await getDb();
  const row = await db.query<{ display_name: string }>('select display_name from public.users where id = $1', [value]);
  const user = row.rows[0];
  return user ? { userId: value, displayName: user.display_name } : null;
}

/** Pour les pages : sans identité, renvoyer vers l’entrée de démonstration. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect('/demo');
  return actor;
}
