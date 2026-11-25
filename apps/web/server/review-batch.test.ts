import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { isRoutineReview } from '@coachos/domain';
import { openDatabase, setDb } from './db/client';
import { USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { markFeedbackReviewed, reopenFeedbackReview } from './commands/feedback';
import { openReviews } from './repo/coach';

// Bilan produit : traiter d’un geste les retours sans signal, et « Annuler » qui les remet dans la file.

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID() });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}

beforeAll(async () => { setDb(await openDatabase()); });

describe('retour sans signal', () => {
  it('seulement réalisé, effort sous 8, sans commentaire, élève à 100 %', () => {
    const base = { resultState: 'completed', hasComment: false, rpe: 4, readiness: null };
    expect(isRoutineReview(base)).toBe(true);
    expect(isRoutineReview({ ...base, rpe: null })).toBe(true);
    expect(isRoutineReview({ ...base, rpe: 8 })).toBe(false);
    expect(isRoutineReview({ ...base, hasComment: true })).toBe(false);
    expect(isRoutineReview({ ...base, resultState: 'partial' })).toBe(false);
    expect(isRoutineReview({ ...base, resultState: 'missed' })).toBe(false);
    expect(isRoutineReview({ ...base, readiness: 'not_quite' })).toBe(false);
    expect(isRoutineReview({ ...base, readiness: 'yes' })).toBe(true);
  });
});

describe('annuler un traitement', () => {
  it('le retour revient dans la file ; coach B, élève affecté et élève tiers ne peuvent pas', async () => {
    const before = await openReviews(USERS.marine, WORKSPACE_A);
    const item = before.find((r) => r.workoutId && r.revision);
    expect(item).toBeTruthy();
    const target = { workspaceId: WORKSPACE_A, athleteId: item!.athleteId, workoutId: item!.workoutId! };

    expect((await markFeedbackReviewed({ ...meta(USERS.marine), ...target }, { expectedRevision: item!.revision })).status).toBe(200);
    expect((await openReviews(USERS.marine, WORKSPACE_A)).some((r) => r.id === item!.id)).toBe(false);

    for (const other of [USERS.hugo, USERS.camille, USERS.lea]) {
      expect(await codeOf(reopenFeedbackReview({ ...meta(other), ...target }))).toBe('RESOURCE_NOT_VISIBLE');
    }
    const r = await reopenFeedbackReview({ ...meta(USERS.marine), ...target });
    expect(r.body).toEqual({ reopened: true });
    expect((await openReviews(USERS.marine, WORKSPACE_A)).some((x) => x.id === item!.id)).toBe(true);
    // Rejouer l’annulation ne change rien.
    expect((await reopenFeedbackReview({ ...meta(USERS.marine), ...target })).body).toEqual({ reopened: false });
  });
});
