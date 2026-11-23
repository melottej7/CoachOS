import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';

// D-127 · Droits en base, table par table : chaque table publique a la sécurité par ligne active, rien pour `anon`,
// aucune écriture directe pour `authenticated` (les écritures passent par les commandes serveur), et une lecture
// accordée seulement là où une politique la filtre. Une table ajoutée plus tard sans ces garde-fous fait échouer ce test.

let db: Db;

interface TableRow { t: string; rls: boolean }

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
});

async function publicTables(): Promise<TableRow[]> {
  const r = await db.query<TableRow>(
    `select c.relname as t, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' order by 1`,
  );
  return r.rows;
}

async function can(role: string, table: string, privilege: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>('select has_table_privilege($1, $2, $3) as ok', [role, `public.${table}`, privilege]);
  return Boolean(r.rows[0]?.ok);
}

describe('droits en base, table par table (D-127)', () => {
  it('chaque table publique a la sécurité par ligne active', async () => {
    const tables = await publicTables();
    expect(tables.length).toBeGreaterThan(60);
    expect(tables.filter((x) => !x.rls).map((x) => x.t)).toEqual([]);
  });

  it('le rôle anonyme n’a aucun droit sur aucune table', async () => {
    const open: string[] = [];
    for (const { t } of await publicTables()) {
      for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) if (await can('anon', t, p)) open.push(`${t}:${p}`);
    }
    expect(open).toEqual([]);
  });

  it('un utilisateur connecté n’écrit jamais directement : toutes les écritures passent par les commandes', async () => {
    const open: string[] = [];
    for (const { t } of await publicTables()) {
      for (const p of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) if (await can('authenticated', t, p)) open.push(`${t}:${p}`);
    }
    expect(open).toEqual([]);
  });

  it('chaque lecture accordée à un utilisateur connecté est filtrée par au moins une politique', async () => {
    const policies = await db.query<{ t: string }>(
      `select distinct tablename as t from pg_policies where schemaname = 'public' and cmd in ('SELECT', 'ALL') and 'authenticated' = any(roles)`,
    );
    const filtered = new Set(policies.rows.map((x) => x.t));
    const readable: string[] = [];
    for (const { t } of await publicTables()) if (await can('authenticated', t, 'SELECT')) readable.push(t);
    expect(readable.length).toBeGreaterThan(30);
    expect(readable.filter((t) => !filtered.has(t))).toEqual([]);
  });
});
