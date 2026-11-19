import { randomUUID } from 'node:crypto';
import { addDays, todayIn, weekStart } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { createWorkout } from './commands/workouts';
import { athleteStats } from './repo/stats';
import { portfolio } from './repo/portfolio';

// D-037 : suivi de l’entraînement, coach affecté ou élève lui-même ; séances publiées seulement.

const today = todayIn(TIME_ZONE);
const from = addDays(weekStart(today), -49);
const to = addDays(weekStart(today), 6);
const stats = (user: string, aid: string) => athleteStats(user, WORKSPACE_A, aid, from, to, today);

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('statistiques d’un élève', () => {
  it('lisibles par le coach affecté et par l’élève lui-même, par personne d’autre', async () => {
    const coach = await stats(USERS.marine, ATHLETES.camille);
    const self = await stats(USERS.camille, ATHLETES.camille);
    expect(coach).not.toBeNull();
    expect(self).toEqual(coach);
    expect(coach!.summary.weeks).toHaveLength(8);
    expect(await stats(USERS.noah, ATHLETES.camille)).toBeNull();
    expect(await stats(USERS.hugo, ATHLETES.camille)).toBeNull();
    expect(await stats(USERS.lea, ATHLETES.camille)).toBeNull();
  });

  it('un brouillon n’entre pas dans les chiffres', async () => {
    const before = await stats(USERS.marine, ATHLETES.camille);
    const meta = { actorId: USERS.marine, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille };
    await createWorkout(meta, { data: { localDate: today, timeZone: TIME_ZONE, sport: 'running', title: 'Brouillon', durationSeconds: 3600, intervals: [] } });
    const after = await stats(USERS.marine, ATHLETES.camille);
    expect(after!.summary.plannedSeconds).toBe(before!.summary.plannedSeconds);
    expect(after!.summary.weeks).toEqual(before!.summary.weeks);
  });

  it('la régularité de la liste des élèves = celle du suivi sur 28 jours (D-043)', async () => {
    const p = await portfolio(USERS.marine, WORKSPACE_A, TIME_ZONE);
    for (const a of p.roster.filter((x) => x.state === 'active')) {
      const s = await athleteStats(USERS.marine, WORKSPACE_A, a.id, addDays(today, -27), today, today);
      expect({ id: a.id, pct: a.regularity.pct, done: a.regularity.done, due: a.regularity.due })
        .toEqual({ id: a.id, pct: s!.summary.completion, done: s!.summary.done, due: s!.summary.due });
    }
    expect(p.roster.some((a) => a.regularity.due > 0)).toBe(true);
  });
});
