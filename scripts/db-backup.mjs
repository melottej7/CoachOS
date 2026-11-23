// D-116 · Sauvegarde de la base en ligne (schéma puis données) dans backups/, dossier ignoré par Git.
// Usage : npm run db:backup  (Docker ouvert ; projet Supabase lié). Les fichiers contiennent des données personnelles :
// à garder sur le Mac, à effacer au plus tard après 30 jours (politique de confidentialité, D-115).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'backups');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const env = { ...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/.docker/bin` };

function run(args, label) {
  const r = spawnSync('npx', ['supabase', ...args], { cwd: root, env, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`Sauvegarde interrompue (${label}). Docker est-il ouvert ? Le projet est-il lié (npx supabase link) ?`);
    process.exit(r.status ?? 1);
  }
}

run(['db', 'dump', '--linked', '-f', path.join(dir, `${stamp}-schema.sql`)], 'schéma');
run(['db', 'dump', '--linked', '--data-only', '-f', path.join(dir, `${stamp}-data.sql`)], 'données');
console.log(`Sauvegarde écrite dans backups/${stamp}-schema.sql et backups/${stamp}-data.sql`);
