// D-116, D-163 · Sauvegarde de la base en ligne (schéma, données, historique des migrations) dans backups/, dossier ignoré par Git.
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
// D-163 · Historique des migrations : sans lui, la prochaine mise en ligne rejouerait les 45 migrations sur une base restaurée.
run(['db', 'dump', '--linked', '--data-only', '--schema', 'supabase_migrations', '-f', path.join(dir, `${stamp}-migrations.sql`)], 'historique des migrations');
console.log(`Sauvegarde écrite dans backups/ : ${stamp}-schema.sql, ${stamp}-data.sql, ${stamp}-migrations.sql`);
console.log(`Pour restaurer un jour dans un projet Supabase neuf : npm run db:restore -- ${stamp} "<adresse de la nouvelle base>"`);
