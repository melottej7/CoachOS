import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { archiveAthlete, restoreAthlete } from './commands/portfolio';
import { listAssignedAthletes, openReviews } from './repo/coach';
import { athleteContext } from './repo/context';

// Bilan produit : retirer un élève en un geste, réversible ; réservé au propriétaire.

let db: Db;
const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}

beforeAll(async () => { db = await openDatabase(); setDb(db); });

describe('retirer un élève', () => {
  it('seule la propriétaire peut ; coach d’un autre espace, élève lui-même et élève tiers sont refusés', async () => {
    for (const other of [USERS.hugo, USERS.camille, USERS.lea, USERS.noah]) {
      expect(await codeOf(archiveAthlete(meta(other)))).toBe('RESOURCE_NOT_VISIBLE');
    }
  });

  it('l’élève disparaît des listes et de la file, perd l’accès, puis « Annuler » le rétablit tel quel', async () => {
    expect((await openReviews(USERS.marine, WORKSPACE_A)).some((r) => r.athleteId === ATHLETES.camille)).toBe(true);
    expect((await archiveAthlete(meta(USERS.marine))).body).toEqual({ id: ATHLETES.camille, state: 'archived' });
    expect((await listAssignedAthletes(USERS.marine, WORKSPACE_A)).some((a) => a.id === ATHLETES.camille)).toBe(false);
    expect((await openReviews(USERS.marine, WORKSPACE_A)).some((r) => r.athleteId === ATHLETES.camille)).toBe(false);
    expect(await athleteContext(USERS.camille, WORKSPACE_A)).toBeNull();
    // Rien n’est effacé.
    const kept = await db.query<{ n: number }>('select count(*)::int as n from public.workouts where workspace_id = $1 and athlete_id = $2', [WORKSPACE_A, ATHLETES.camille]);
    expect(kept.rows[0]!.n).toBeGreaterThan(0);

    for (const other of [USERS.hugo, USERS.camille, USERS.lea]) expect(await codeOf(restoreAthlete(meta(other)))).toBe('RESOURCE_NOT_VISIBLE');
    expect((await restoreAthlete(meta(USERS.marine))).body).toEqual({ id: ATHLETES.camille, state: 'active' });
    expect(await athleteContext(USERS.camille, WORKSPACE_A)).not.toBeNull();
    expect((await openReviews(USERS.marine, WORKSPACE_A)).some((r) => r.athleteId === ATHLETES.camille)).toBe(true);
  });
});
