import { randomUUID } from 'node:crypto';
import { activityFingerprint, activityTotals, saveFeedbackSchema } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { saveFeedback } from './commands/feedback';
import { coachWorkout } from './repo/coach';
import { athleteWorkout } from './repo/athlete';

// D-064 (CE-X-03) : plusieurs activités par séance, correction possible, aucun double comptage.

const meta = (actorId: string, workoutId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, workoutId }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const warmup = { format: 'fit', sport: 'running', startedAt: '2026-11-19T06:30:00.000Z', seconds: 900, distanceM: 2400 } as const;
const run = { format: 'fit', sport: 'running', startedAt: '2026-11-19T06:47:00.000Z', seconds: 1800, distanceM: 5600 } as const;

beforeAll(async () => { setDb(await openDatabase()); });

describe('activités rattachées à une séance (D-064)', () => {
  it('domaine : empreinte stable, totaux, refus des doublons et des séances non faites', () => {
    expect(activityFingerprint(run)).toBe(activityFingerprint({ ...run, startedAt: '2026-11-19T06:47:00Z' }));
    expect(activityTotals([warmup, run])).toEqual({ seconds: 2700, distanceM: 8000 });
    expect(activityTotals([])).toEqual({ seconds: null, distanceM: null });
    expect(saveFeedbackSchema.safeParse({ publishedRevision: 1, state: 'completed', activities: [run, run] }).success).toBe(false);
    expect(saveFeedbackSchema.safeParse({ publishedRevision: 1, state: 'missed', activities: [run] }).success).toBe(false);
    expect(saveFeedbackSchema.safeParse({ publishedRevision: 1, state: 'completed', activities: [{ format: 'fit' }] }).success).toBe(false);
  });

  it('deux activités sur une séance ; la même ailleurs refusée ; retirée puis déplacée ; coach et élève les lisent', async () => {
    const today = SEED_WORKOUTS.camilleToday, yesterday = SEED_WORKOUTS.camilleYesterday;
    const r1 = await saveFeedback(meta(USERS.camille, today), {
      publishedRevision: 1, state: 'completed', durationSeconds: 2700, distanceM: 8000, measureFile: 'fit', activities: [warmup, run],
    });
    expect((r1.body as { item: { activities: unknown[] } }).item.activities).toHaveLength(2);
    const coach = (await coachWorkout(USERS.marine, WORKSPACE_A, ATHLETES.camille, today))!.feedback!;
    expect(coach.activities.map((a) => a.seconds)).toEqual([900, 1800]);
    expect((await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, today))!.feedback!.activities).toHaveLength(2);
    // Renvoyer le même retour (même activités) ne duplique rien.
    await saveFeedback(meta(USERS.camille, today), { publishedRevision: 1, expectedRevision: 1, state: 'completed', durationSeconds: 2700, distanceM: 8000, measureFile: 'fit', activities: [warmup, run] });
    const count = async () => (await readAs(USERS.camille, (tx) => tx.query('select 1 from public.workout_activities'))).rows.length;
    expect(await count()).toBe(2);
    // La course rattachée par erreur à la séance d’hier : refusée tant qu’elle est sur celle d’aujourd’hui.
    const rev = async () => (await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, yesterday))!.feedback?.revision ?? null;
    const msg = await saveFeedback(meta(USERS.camille, yesterday), { publishedRevision: 1, expectedRevision: await rev(), state: 'completed', durationSeconds: 1800, activities: [run] }).catch((e: AppError) => e);
    expect(msg).toMatchObject({ code: 'CONFLICT_OR_QUOTA' });
    expect((msg as AppError).message).toMatch(/déjà rattachée à « Footing facile »/);
    // Correction : retirée d’aujourd’hui (reste l’échauffement), puis rattachée à hier.
    await saveFeedback(meta(USERS.camille, today), { publishedRevision: 1, expectedRevision: 2, state: 'completed', durationSeconds: 900, distanceM: 2400, measureFile: 'fit', activities: [warmup] });
    await saveFeedback(meta(USERS.camille, yesterday), { publishedRevision: 1, expectedRevision: await rev(), state: 'completed', durationSeconds: 1800, distanceM: 5600, measureFile: 'fit', activities: [run] });
    expect((await coachWorkout(USERS.marine, WORKSPACE_A, ATHLETES.camille, today))!.feedback!.activities).toHaveLength(1);
    expect((await coachWorkout(USERS.marine, WORKSPACE_A, ATHLETES.camille, yesterday))!.feedback!.activities.map((a) => a.distanceM)).toEqual([5600]);
    expect(await count()).toBe(2);
    // Séance finalement non faite : ses activités sont retirées.
    await saveFeedback(meta(USERS.camille, yesterday), { publishedRevision: 1, expectedRevision: await rev(), state: 'missed' });
    expect(await count()).toBe(1);
    // Un autre élève ne voit pas ces activités ; le coach non affecté non plus.
    expect((await readAs(USERS.noah, (tx) => tx.query('select 1 from public.workout_activities'))).rows).toHaveLength(0);
    expect(await codeOf(saveFeedback(meta(USERS.noah, today), { publishedRevision: 1, state: 'completed', activities: [run] }))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
