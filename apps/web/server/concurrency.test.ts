import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb, type Db } from './db/client';
import { postgresDb } from './db/driver';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { repoRoot } from './db/migrate';
import { assertOnlyFixtureUsers, clearData, seed, SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { saveFeedback } from './commands/feedback';
import { publishWorkouts } from './commands/workouts';

// Concurrence réelle : seulement sur le PostgreSQL de Supabase local (PGlite sérialise tout).
const onPostgres = process.env.COACHOS_TEST_PG === '1';
let db: Db;
let prepared = false;

const settle = (ps: Promise<unknown>[]) =>
  Promise.allSettled(ps).then((rs) =>
    rs.map((r) => (r.status === 'fulfilled' ? 'OK' : r.reason instanceof AppError ? r.reason.code : `BRUT:${(r.reason as { code?: string })?.code ?? '?'}`)),
  );

describe.skipIf(!onPostgres)('concurrence sur PostgreSQL', () => {
  beforeAll(async () => {
    process.loadEnvFile(path.join(repoRoot(), 'apps', 'web', '.env.local'));
    const { supabaseAuthUsers } = await import('./supabase/admin');
    db = postgresDb(process.env.DATABASE_URL!);
    await assertOnlyFixtureUsers(db);
    prepared = true;
    await clearData(db, { deleteAuthUsers: false });
    await seed(db, { ensureAuthUsers: supabaseAuthUsers });
    setDb(db);
  });
  afterAll(async () => {
    if (!prepared) {
      // Garde-fou refusé ou base PGlite : ne rien effacer.
      if (onPostgres) await db?.close();
      return;
    }
    const { supabaseAuthUsers } = await import('./supabase/admin');
    await clearData(db, { deleteAuthUsers: false });
    await seed(db, { ensureAuthUsers: supabaseAuthUsers });
    await db.close();
  });

  const base = { workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, requestId: randomUUID() };
  const fb = { publishedRevision: 1, expectedRevision: null, state: 'completed', rpe: 5 };

  it('cinq envois simultanés avec la même clé : un seul retour, réponses identiques', async () => {
    const key = randomUUID();
    const rs = await Promise.all(
      Array.from({ length: 5 }, () => saveFeedback({ ...base, actorId: USERS.camille, idempotencyKey: key, workoutId: SEED_WORKOUTS.camilleToday }, fb)),
    );
    // jsonb réordonne les clés : comparer le contenu, pas le texte.
    for (const r of rs) expect(r).toEqual(rs[0]);
    const n = await db.query<{ n: number }>('select count(*)::int as n from public.workout_results where workout_id = $1', [SEED_WORKOUTS.camilleToday]);
    expect(n.rows[0]!.n).toBe(1);
  });

  it('deux premiers envois depuis deux appareils : un succès, un conflit propre (409), jamais une erreur brute', async () => {
    const sid = SEED_WORKOUTS.noahToday;
    const m = { workspaceId: WORKSPACE_A, athleteId: ATHLETES.noah, requestId: randomUUID(), actorId: USERS.noah, workoutId: sid };
    const codes = await settle([saveFeedback({ ...m, idempotencyKey: randomUUID() }, fb), saveFeedback({ ...m, idempotencyKey: randomUUID() }, fb)]);
    expect(codes.sort()).toEqual(['CONFLICT_OR_QUOTA', 'OK']);
  });

  it('double publication simultanée avec deux clés : une seule version publiée', async () => {
    const body = { changes: [{ id: SEED_WORKOUTS.camilleDraft, revision: 1 }] };
    const m = { ...base, actorId: USERS.marine };
    const codes = await settle([publishWorkouts({ ...m, idempotencyKey: randomUUID() }, body), publishWorkouts({ ...m, idempotencyKey: randomUUID() }, body)]);
    expect(codes).toEqual(['OK', 'OK']);
    const n = await db.query<{ n: number }>('select count(*)::int as n from public.publication_items where workout_id = $1', [SEED_WORKOUTS.camilleDraft]);
    expect(n.rows[0]!.n).toBe(1);
  });
});
