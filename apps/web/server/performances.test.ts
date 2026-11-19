import { randomUUID } from 'node:crypto';
import { addDays, todayIn } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { addPerformance, deletePerformance, readPerformances } from './commands/performances';

// D-060 : résultats de référence saisis par le coach affecté, lus par l’élève.

const meta = (actorId: string, extra: object = {}) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, ...extra }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const today = todayIn(TIME_ZONE);
const race = { sport: 'running', kind: 'race', name: '10 km de Bruxelles', distanceM: 10000, durationS: 3000, doneOn: addDays(today, -60) };

beforeAll(async () => { setDb(await openDatabase()); });

describe('résultats de référence', () => {
  it('le coach ajoute ; l’élève lit ; personne d’autre', async () => {
    const r = await addPerformance(meta(USERS.marine), race);
    expect(r.status).toBe(201);
    expect(await readPerformances(USERS.camille, WORKSPACE_A, ATHLETES.camille)).toMatchObject([{ name: '10 km de Bruxelles', durationS: 3000 }]);
    expect(await readPerformances(USERS.noah, WORKSPACE_A, ATHLETES.camille)).toEqual([]);
    expect(await readPerformances(USERS.hugo, WORKSPACE_A, ATHLETES.camille)).toEqual([]);
  });

  it('refus : élève, autre espace, date future, valeurs hors bornes ; suppression', async () => {
    expect(await codeOf(addPerformance(meta(USERS.camille), race))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(addPerformance(meta(USERS.hugo), race))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(addPerformance(meta(USERS.marine), { ...race, doneOn: addDays(today, 3) }))).toBe('INVALID_FIELDS');
    expect(await codeOf(addPerformance(meta(USERS.marine), { ...race, distanceM: 10 }))).toBe('INVALID_FIELDS');
    const [p] = await readPerformances(USERS.marine, WORKSPACE_A, ATHLETES.camille);
    expect(await codeOf(deletePerformance(meta(USERS.camille, { performanceId: p!.id })))).toBe('RESOURCE_NOT_VISIBLE');
    await deletePerformance(meta(USERS.marine, { performanceId: p!.id }));
    expect(await readPerformances(USERS.marine, WORKSPACE_A, ATHLETES.camille)).toEqual([]);
    expect(await codeOf(deletePerformance(meta(USERS.marine, { performanceId: p!.id })))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
