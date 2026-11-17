// Recrée la base locale fictive. Arrêter `npm run dev` avant : PGlite ne partage pas son dossier entre processus.
import fs from 'node:fs';
import { defaultDataDir, openDatabase } from '../server/db/client';

const dir = defaultDataDir();
fs.rmSync(dir, { recursive: true, force: true });
const db = await openDatabase(dir);
const counts = await db.query<{ t: string; n: number }>(`
  select 'workspaces' t, count(*)::int n from public.workspaces union all
  select 'athletes', count(*)::int from public.athletes union all
  select 'workouts', count(*)::int from public.workouts union all
  select 'feedbacks', count(*)::int from public.feedbacks`);
await db.close();
console.log(`Base recréée dans ${dir}`);
for (const r of counts.rows) console.log(`  ${r.t}: ${r.n}`);
