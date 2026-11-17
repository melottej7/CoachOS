// Écrit apps/web/.env.local à partir de `supabase status` (Supabase local uniquement, clés de démonstration).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../server/db/migrate';

const root = repoRoot();
const env = { ...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/.docker/bin` };
const raw = execFileSync('npx', ['supabase', 'status', '-o', 'json'], { cwd: root, env, encoding: 'utf8' });
const status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
const need = ['API_URL', 'DB_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'];
const missing = need.filter((k) => !status[k]);
if (missing.length) throw new Error(`Supabase local ne répond pas (${missing.join(', ')}). Lancer npm run supabase:start.`);
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL!)) throw new Error('Refus : ce script ne vise que Supabase local.');

const file = path.join(root, 'apps', 'web', '.env.local');
fs.writeFileSync(
  file,
  [
    '# Généré par `npm run supabase:env`. Supabase LOCAL uniquement. Ne pas committer.',
    `DATABASE_URL=${status.DB_URL}`,
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${status.SERVICE_ROLE_KEY}`,
    `MAILPIT_URL=${status.MAILPIT_URL ?? 'http://127.0.0.1:54324'}`,
    '',
  ].join('\n'),
);
console.log(`Écrit : ${path.relative(root, file)} (API ${status.API_URL})`);
