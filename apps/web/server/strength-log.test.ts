import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { todayIn } from '@coachos/domain';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createWorkout, publishWorkouts } from './commands/workouts';
import { saveFeedback } from './commands/feedback';
import { athleteWorkout } from './repo/athlete';
import { strengthHistory } from './repo/stats';

// D-096 (M4) : séries et charges réalisées, enregistrées avec le retour et lues pour la progression.

const meta = (actorId: string, extra: Record<string, string> = {}) => ({
  actorId, workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, idempotencyKey: randomUUID(), requestId: randomUUID(), ...extra,
});
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const intervals = [{ type: 'repeat', times: 3, steps: [
  { type: 'step', phase: 'work', measure: { kind: 'reps', reps: 10 }, intensity: { kind: 'load', min: 16, max: null }, exercise: { id: null, name: 'Squat goblet' } },
  { type: 'step', phase: 'rest', measure: { kind: 'time', seconds: 90 } },
] }];

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('séries et charges réalisées', () => {
  it('enregistrées avec le retour, relues par l’élève, comptées dans la progression ; refusées si la séance n’est pas faite', async () => {
    const today = todayIn(TIME_ZONE);
    const w = await createWorkout(meta(USERS.marine), { data: { localDate: today, timeZone: TIME_ZONE, sport: 'strength', title: 'Renfo jambes', durationSeconds: null, instructions: null, intervals } });
    const { id: sid } = (w.body as { item: { id: string } }).item ?? (w.body as { id: string });
    await publishWorkouts(meta(USERS.marine), { changes: [{ id: sid, revision: 1 }] });
    const log = [{ exerciseId: null, name: 'Squat goblet', sets: [{ reps: 10, kg: 16 }, { reps: 10, kg: 16 }, { reps: 8, kg: 18 }] }];
    const base = { publishedRevision: 1, expectedRevision: null, state: 'completed', strengthLog: log };
    expect(await codeOf(saveFeedback({ ...meta(USERS.camille), workoutId: sid }, { ...base, state: 'missed' }))).toBe('INVALID_FIELDS');
    expect(await codeOf(saveFeedback({ ...meta(USERS.camille), workoutId: sid }, { ...base, strengthLog: [{ name: 'X', sets: [{ reps: 10, kg: 3.3 }] }] }))).toBe('INVALID_FIELDS');
    const r = await saveFeedback({ ...meta(USERS.camille), workoutId: sid }, base);
    expect(r.body).toMatchObject({ item: { strengthLog: [{ name: 'Squat goblet', sets: [{ reps: 10, kg: 16, seconds: null }, { reps: 10, kg: 16, seconds: null }, { reps: 8, kg: 18, seconds: null }] }] } });
    const seen = await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, sid);
    expect(seen?.feedback?.strengthLog[0]?.sets).toHaveLength(3);
    // Progression : l’élève et son coach la lisent ; un coach d’un autre espace, non.
    for (const who of [USERS.camille, USERS.marine]) {
      const h = await strengthHistory(who, WORKSPACE_A, ATHLETES.camille);
      expect(h.at(-1)).toEqual({ date: today, log: expect.any(Array) });
    }
    expect(await strengthHistory(USERS.hugo, WORKSPACE_A, ATHLETES.camille)).toEqual([]);
    expect(await strengthHistory(USERS.noah, WORKSPACE_A, ATHLETES.camille)).toEqual([]);
  });
});
