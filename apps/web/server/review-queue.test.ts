import { randomUUID } from 'node:crypto';
import { matchesReviewFilter, parseReviewFilter, reviewFilterQuery, snoozeChoices, snoozeError, updateReviewSchema } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { commandAs, openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { saveFeedback, updateReview } from './commands/feedback';
import { openReviewCount, openReviews } from './repo/coach';

// D-082 : file des retours. Reporter (date future, retour seul dans la file), remettre, filtre gardé (C09-08).

const fbMeta = (workoutId: string) => ({ actorId: USERS.camille, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, workoutId }) as never;
const rvMeta = (actorId: string, reviewId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, reviewId }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

beforeAll(async () => { setDb(await openDatabase()); });

describe('file des retours (D-082)', () => {
  it('domaine : schéma, date future et 30 jours au plus, choix à 7 h, filtre dans l’adresse', () => {
    expect(updateReviewSchema.safeParse({ state: 'snoozed' }).success).toBe(false);
    expect(updateReviewSchema.safeParse({ state: 'done' }).success).toBe(false);
    expect(updateReviewSchema.safeParse({ state: 'open' }).success).toBe(true);
    const now = new Date('2026-11-19T22:00:00Z');
    expect(snoozeError(new Date('2026-11-19T21:00:00Z'), now)).toMatch(/futur/);
    expect(snoozeError(new Date('2027-01-19T21:00:00Z'), now)).toMatch(/30 jours/);
    expect(snoozeError(new Date('2026-11-20T06:00:00Z'), now)).toBeNull();
    const c = snoozeChoices('2026-11-19', 'Europe/Brussels');
    expect(c.map((x) => x.label)).toEqual(['Demain', 'Dans 3 jours', 'Lundi prochain']);
    expect(c[0]!.at).toBe('2026-11-20T06:00:00.000Z'); // 7 h à Bruxelles en hiver
    const f = parseReviewFilter({ eleve: ATHLETES.camille, seulement: 'effort', groupe: 'pas-un-id' });
    expect(f).toEqual({ athleteId: ATHLETES.camille, teamId: null, only: 'hard' });
    expect(parseReviewFilter(Object.fromEntries(new URLSearchParams(reviewFilterQuery(f).slice(1))))).toEqual(f);
    expect(matchesReviewFilter({ athleteId: ATHLETES.camille, teamIds: [], hasComment: false, rpe: 8 }, f)).toBe(true);
    expect(matchesReviewFilter({ athleteId: ATHLETES.camille, teamIds: [], hasComment: true, rpe: 6 }, f)).toBe(false);
  });

  it('reporter : hors de la file jusqu’à sa date, puis de retour ; remettre ; droits ; correction de l’élève', async () => {
    await saveFeedback(fbMeta(SEED_WORKOUTS.camilleToday), { publishedRevision: 1, state: 'completed', rpe: 8, comment: 'Dur' });
    const before = await openReviews(USERS.marine, WORKSPACE_A);
    const item = before.find((r) => r.workoutId === SEED_WORKOUTS.camilleToday)!;
    expect(item.rpe).toBe(8);
    const count = await openReviewCount(USERS.marine, WORKSPACE_A);
    // Date passée refusée ; élève et autre coach refusés.
    expect(await codeOf(updateReview(rvMeta(USERS.marine, item.id), { state: 'snoozed', snoozeUntil: inHours(-1) }))).toBe('INVALID_FIELDS');
    expect(await codeOf(updateReview(rvMeta(USERS.camille, item.id), { state: 'snoozed', snoozeUntil: inHours(20) }))).toBe('RESOURCE_NOT_VISIBLE');
    const r = await updateReview(rvMeta(USERS.marine, item.id), { state: 'snoozed', snoozeUntil: inHours(20) });
    expect(r.body).toMatchObject({ item: { id: item.id, state: 'snoozed', athleteId: ATHLETES.camille } });
    expect(await openReviewCount(USERS.marine, WORKSPACE_A)).toBe(count - 1);
    expect((await openReviews(USERS.marine, WORKSPACE_A, undefined, 'snoozed')).map((x) => x.id)).toEqual([item.id]);
    // La date arrive : le retour revient seul.
    await commandAs(USERS.marine, (tx) => tx.query(`update public.review_items set due_at = now() - interval '1 minute' where id = $1`, [item.id]));
    expect(await openReviewCount(USERS.marine, WORKSPACE_A)).toBe(count);
    expect(await openReviews(USERS.marine, WORKSPACE_A, undefined, 'snoozed')).toEqual([]);
    // Reporter puis remettre tout de suite.
    await updateReview(rvMeta(USERS.marine, item.id), { state: 'snoozed', snoozeUntil: inHours(48) });
    await updateReview(rvMeta(USERS.marine, item.id), { state: 'open' });
    expect(await openReviewCount(USERS.marine, WORKSPACE_A)).toBe(count);
    // Une correction de l’élève remet le retour dans la file.
    await updateReview(rvMeta(USERS.marine, item.id), { state: 'snoozed', snoozeUntil: inHours(48) });
    await saveFeedback(fbMeta(SEED_WORKOUTS.camilleToday), { publishedRevision: 1, expectedRevision: 1, state: 'completed', rpe: 7, comment: 'Finalement ça allait' });
    expect((await openReviews(USERS.marine, WORKSPACE_A)).some((x) => x.id === item.id)).toBe(true);
  });
});
