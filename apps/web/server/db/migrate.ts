import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

/** Remonte jusqu’à la racine du dépôt (dossier qui contient supabase/migrations). */
export function repoRoot(start = process.cwd()): string {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'supabase', 'migrations'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('supabase/migrations introuvable depuis ' + start);
    dir = parent;
  }
}

const shimPath = () => {
  // Fonctionne depuis Next (cwd = apps/web) comme depuis Vitest (cwd = racine).
  const root = repoRoot();
  return path.join(root, 'apps', 'web', 'server', 'db', 'local-auth-shim.sql');
};

export function migrationFiles(): { version: string; name: string; file: string }[] {
  const dir = path.join(repoRoot(), 'supabase', 'migrations');
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((f) => ({ version: f.slice(0, 14), name: f.slice(15, -4), file: path.join(dir, f) }));
}

/** Applique le shim auth puis les migrations manquantes, dans l’ordre du manifeste. */
export async function migrate(db: PGlite): Promise<string[]> {
  const hasShim = await db.query<{ ok: boolean }>(
    `select exists(select 1 from information_schema.schemata where schema_name = 'supabase_migrations') as ok`,
  );
  if (!hasShim.rows[0]?.ok) {
    await db.exec(fs.readFileSync(shimPath(), 'utf8'));
  }
  const applied = new Set(
    (await db.query<{ version: string }>('select version from supabase_migrations.schema_migrations')).rows.map(
      (r) => r.version,
    ),
  );
  const done: string[] = [];
  for (const m of migrationFiles()) {
    if (applied.has(m.version)) continue;
    const sql = fs.readFileSync(m.file, 'utf8');
    // Le fichier de référence gère sa propre transaction (begin/commit).
    await db.exec(sql);
    await db.query('insert into supabase_migrations.schema_migrations(version, name) values ($1, $2)', [
      m.version,
      m.name,
    ]);
    done.push(`${m.version}_${m.name}`);
  }
  return done;
}
