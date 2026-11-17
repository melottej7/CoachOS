import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../db/client';
import { safeNext, supabaseConfigured, supabaseServer } from '../supabase/server';

/**
 * Identité de la requête.
 * 1. Session Supabase Auth (lien magique) quand Supabase est configuré : identité vérifiée.
 * 2. Sinon, ou en complément en développement, identité de démonstration (D-003) :
 *    COACHOS_DEMO_AUTH=1 et hors production uniquement.
 */
export const DEMO_COOKIE = 'coachos_demo_identity';

export function demoAuthEnabled(): boolean {
  return process.env.COACHOS_DEMO_AUTH === '1' && process.env.NODE_ENV !== 'production';
}

export interface Actor {
  userId: string;
  displayName: string;
  source: 'supabase' | 'demo';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function displayName(userId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.query<{ display_name: string }>('select display_name from public.users where id = $1', [userId]);
  return row.rows[0]?.display_name ?? null;
}

export async function getActor(): Promise<Actor | null> {
  // Lire la requête d’abord : toute page privée reste rendue dynamiquement.
  const store = await cookies();
  if (supabaseConfigured()) {
    const { data } = await (await supabaseServer()).auth.getUser();
    const user = data.user;
    if (user) {
      let name = await displayName(user.id);
      if (!name) {
        // Première connexion : profil minimal, modifiable plus tard (X07).
        const fromMeta = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '';
        name = (fromMeta || (user.email ?? 'Utilisateur').split('@')[0] || 'Utilisateur').slice(0, 100);
        const db = await getDb();
        await db.query('insert into public.users(id, display_name) values ($1, $2) on conflict (id) do nothing', [user.id, name]);
      }
      return { userId: user.id, displayName: name, source: 'supabase' };
    }
  }
  if (!demoAuthEnabled()) return null;
  const value = store.get(DEMO_COOKIE)?.value;
  if (!value || !UUID.test(value)) return null;
  const name = await displayName(value);
  return name ? { userId: value, displayName: name, source: 'demo' } : null;
}

/** Sans identité : page de connexion, en conservant la destination locale. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (actor) return actor;
  if (!supabaseConfigured()) redirect('/demo');
  const next = safeNext((await headers()).get('x-coachos-path'));
  redirect(next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
}
