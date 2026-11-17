// Recharge le jeu fictif dans Supabase local : comptes Auth (UUID fixes) puis données métier.
import path from 'node:path';
import { postgresDb } from '../server/db/driver';
import { repoRoot } from '../server/db/migrate';
import { clearData, seed } from '../server/db/seed';
import { supabaseAuthUsers } from '../server/supabase/admin';

process.loadEnvFile(path.join(repoRoot(), 'apps', 'web', '.env.local'));
const url = process.env.DATABASE_URL ?? '';
if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error('Refus : DATABASE_URL doit viser Supabase local.');
const db = postgresDb(url);
await clearData(db, { deleteAuthUsers: false });
await seed(db, { ensureAuthUsers: supabaseAuthUsers });
const n = await db.query<{ t: string; n: number }>(`
  select 'comptes auth' t, count(*)::int n from auth.users union all
  select 'athlètes', count(*)::int from public.athletes union all
  select 'séances', count(*)::int from public.workouts union all
  select 'retours', count(*)::int from public.feedbacks`);
await db.close();
console.log('Jeu fictif chargé dans Supabase local :');
for (const r of n.rows) console.log(`  ${r.t}: ${r.n}`);
