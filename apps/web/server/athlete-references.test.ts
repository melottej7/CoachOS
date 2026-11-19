import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { readAthleteReferences, saveAthleteReferences } from './commands/athlete-references';

// CE-B-03, D-029 : repères (VMA) fixés par le coach affecté, lus par l’athlète.

const meta = (actorId: string, athleteId: string = ATHLETES.camille) => ({
  actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId,
});
async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('repères d’entraînement', () => {
  it('le coach affecté fixe la VMA (arrondie au dixième), puis l’efface', async () => {
    const r = await saveAthleteReferences(meta(USERS.marine), { vmaKmh: 15.26 });
    expect(r.body).toMatchObject({ item: { vmaKmh: 15.3, revision: 1 } });
    expect(await readAthleteReferences(USERS.camille, WORKSPACE_A, ATHLETES.camille)).toMatchObject({ vmaKmh: 15.3 });
    await saveAthleteReferences(meta(USERS.marine), { vmaKmh: null });
    expect(await readAthleteReferences(USERS.marine, WORKSPACE_A, ATHLETES.camille)).toMatchObject({ vmaKmh: null });
    await saveAthleteReferences(meta(USERS.marine), { vmaKmh: 16 });
  });

  it('lecture : ni un autre athlète, ni un coach d’un autre espace', async () => {
    expect(await readAthleteReferences(USERS.noah, WORKSPACE_A, ATHLETES.camille)).toMatchObject({ vmaKmh: null });
    expect(await readAthleteReferences(USERS.hugo, WORKSPACE_A, ATHLETES.camille)).toMatchObject({ vmaKmh: null });
  });

  it('écriture : refusée à l’athlète, au coach d’un autre espace ; valeurs hors bornes refusées', async () => {
    expect(await codeOf(saveAthleteReferences(meta(USERS.camille), { vmaKmh: 20 }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(saveAthleteReferences(meta(USERS.hugo), { vmaKmh: 20 }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(saveAthleteReferences(meta(USERS.marine), { vmaKmh: 45 }))).toBe('INVALID_FIELDS');
    expect(await codeOf(saveAthleteReferences(meta(USERS.marine), { vmaKmh: 15, fcMax: 190 }))).toBe('INVALID_FIELDS');
    expect(await readAthleteReferences(USERS.camille, WORKSPACE_A, ATHLETES.camille)).toMatchObject({ vmaKmh: 16, ftpW: null, cssSecPer100: null });
  });

  it('FTP et CSS (D-055) : fixées par le coach, conservées si absentes, lues par l’élève ; bornes ; pas de FC', async () => {
    await saveAthleteReferences(meta(USERS.marine), { vmaKmh: 16, ftpW: 230, cssSecPer100: 105 });
    expect(await readAthleteReferences(USERS.camille, WORKSPACE_A, ATHLETES.camille)).toEqual({ vmaKmh: 16, ftpW: 230, cssSecPer100: 105 });
    // Champs absents : inchangés ; null : effacé.
    await saveAthleteReferences(meta(USERS.marine), { vmaKmh: 16.5 });
    expect(await readAthleteReferences(USERS.marine, WORKSPACE_A, ATHLETES.camille)).toEqual({ vmaKmh: 16.5, ftpW: 230, cssSecPer100: 105 });
    await saveAthleteReferences(meta(USERS.marine), { vmaKmh: 16.5, cssSecPer100: null });
    expect(await readAthleteReferences(USERS.camille, WORKSPACE_A, ATHLETES.camille)).toEqual({ vmaKmh: 16.5, ftpW: 230, cssSecPer100: null });
    expect(await codeOf(saveAthleteReferences(meta(USERS.marine), { vmaKmh: 16, ftpW: 900 }))).toBe('INVALID_FIELDS');
    expect(await codeOf(saveAthleteReferences(meta(USERS.marine), { vmaKmh: 16, cssSecPer100: 20 }))).toBe('INVALID_FIELDS');
    expect(await codeOf(saveAthleteReferences(meta(USERS.camille), { vmaKmh: 16, ftpW: 300 }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(saveAthleteReferences(meta(USERS.hugo), { vmaKmh: 16, ftpW: 300 }))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
