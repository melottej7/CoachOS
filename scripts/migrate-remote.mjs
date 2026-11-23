// D-122 · Migrations appliquées à la base en ligne pendant la construction Vercel, juste avant que le nouveau code
// ne soit servi : jamais de code en ligne qui attend une migration. Additives uniquement (règle du dépôt).
//
// Réglages attendus (Vercel › Environment Variables) : SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_ID.
// Sans eux (construction locale, aperçu), le script l'écrit et laisse passer. Avec eux, un échec arrête la construction :
// l'ancienne version reste en ligne.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dryRun = process.argv.includes('--dry-run');
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_DB_PASSWORD: password, SUPABASE_PROJECT_ID: project } = process.env;

if (!token || !password || !project) {
  console.log('[migrations] SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD ou SUPABASE_PROJECT_ID absent : base en ligne non touchée.');
  process.exit(0);
}
if (!/^[a-z]{20}$/.test(project)) {
  console.error('[migrations] SUPABASE_PROJECT_ID invalide (20 lettres attendues).');
  process.exit(1);
}

function run(args) {
  const r = spawnSync('npx', ['--yes', 'supabase@3', ...args], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token, SUPABASE_DB_PASSWORD: password, PGPASSWORD: password },
  });
  if (r.status !== 0) {
    console.error(`[migrations] échec de « supabase ${args.slice(0, 2).join(' ')} » : construction arrêtée, l'ancienne version reste en ligne.`);
    process.exit(r.status ?? 1);
  }
}

run(['link', '--project-ref', project, '--password', password]);
run(['db', 'push', '--linked', '--password', password, ...(dryRun ? ['--dry-run'] : [])]);
console.log(dryRun ? '[migrations] simulation terminée.' : '[migrations] base en ligne à jour.');
