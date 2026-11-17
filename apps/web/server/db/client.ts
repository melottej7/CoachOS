import fs from 'node:fs';
import path from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { migrate, repoRoot } from './migrate';
import { seed } from './seed';

export type Tx = Transaction;

/** Ouvre une base PGlite (fichier ou mémoire), applique les migrations et charge le jeu fictif si vide. */
export async function openDatabase(dataDir?: string): Promise<PGlite> {
  if (dataDir) fs.mkdirSync(path.dirname(dataDir), { recursive: true });
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;
  await migrate(db);
  const users = await db.query<{ n: number }>('select count(*)::int as n from public.users');
  if ((users.rows[0]?.n ?? 0) === 0) await seed(db);
  return db;
}

export function defaultDataDir(): string {
  return process.env.COACHOS_PGLITE_DIR ?? path.join(repoRoot(), '.data', 'pglite');
}

const globalForDb = globalThis as unknown as { __coachosDb?: Promise<PGlite> };

/** Une seule instance par processus, y compris lors du rechargement à chaud de Next. */
export function getDb(): Promise<PGlite> {
  globalForDb.__coachosDb ??= openDatabase(defaultDataDir()).catch((error: unknown) => {
    globalForDb.__coachosDb = undefined;
    throw error;
  });
  return globalForDb.__coachosDb;
}

/** Pour les tests : injecter une base en mémoire. */
export function setDb(db: PGlite): void {
  globalForDb.__coachosDb = Promise.resolve(db);
}

async function setActor(tx: Tx, userId: string) {
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
