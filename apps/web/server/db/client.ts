import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { postgresDb, type Db, type Tx } from './driver';
import { migrate, repoRoot } from './migrate';
import { pgliteAuthUsers, seed } from './seed';

export type { Db, Tx };

/**
 * Deux moteurs (DECISIONS D-002, D-014) :
 * - DATABASE_URL défini : PostgreSQL de Supabase local, migrations appliquées par le CLI Supabase ;
 * - sinon : PGlite en fichier (.data/pglite) ou en mémoire pour les tests, migrations appliquées ici.
 */
export async function openDatabase(dataDir?: string): Promise<Db> {
  if (dataDir) fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const lite = dataDir ? new PGlite(dataDir) : new PGlite();
  await lite.waitReady;
  await migrate(lite);
  const db = lite as unknown as Db;
  const users = await db.query<{ n: number }>('select count(*)::int as n from public.users');
  if ((users.rows[0]?.n ?? 0) === 0) await seed(db, { ensureAuthUsers: pgliteAuthUsers(db) });
  return db;
}

export function defaultDataDir(): string {
  return process.env.COACHOS_PGLITE_DIR ?? path.join(repoRoot(), '.data', 'pglite');
}

export const usingPostgres = () => Boolean(process.env.DATABASE_URL);

const globalForDb = globalThis as unknown as { __coachosDb?: Promise<Db> };

/** Une seule instance par processus, y compris lors du rechargement à chaud de Next. */
export function getDb(): Promise<Db> {
  globalForDb.__coachosDb ??= (
    usingPostgres() ? Promise.resolve(postgresDb(process.env.DATABASE_URL!)) : openDatabase(defaultDataDir())
  ).catch((error: unknown) => {
    globalForDb.__coachosDb = undefined;
    throw error;
  });
  return globalForDb.__coachosDb;
}

/** Pour les tests : injecter une base. */
export function setDb(db: Db): void {
  globalForDb.__coachosDb = Promise.resolve(db);
}

async function setActor(tx: Tx, userId: string) {
  // Même réglage que Supabase : auth.uid() lit request.jwt.claim.sub.
  await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
}

/**
 * Lecture sous le rôle `authenticated` : les politiques RLS de la migration s’appliquent.
 * C’est la seule voie de lecture des données d’athlète par les pages.
 */
export async function readAs<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await setActor(tx, userId);
    await tx.exec('set local role authenticated');
    return fn(tx);
  });
}

/**
 * Commande serveur (équivalent service_role) : chaque commande vérifie elle-même les droits
 * avec les fonctions private.* dans la même transaction, avant d’écrire.
 */
export async function commandAs<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await setActor(tx, userId);
    return fn(tx);
  });
}

/** Transaction sans identité (vérifications préalables à la création d’un compte). Aucune lecture RLS. */
export async function systemTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction(fn);
}
