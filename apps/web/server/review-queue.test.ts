import { randomUUID } from 'node:crypto';
import { matchesReviewFilter, parseReviewFilter, reviewFilterQuery, snoozeChoices, snoozeError, updateReviewSchema } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { commandAs, openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { saveFeedback, updateReview } from './commands/feedback';
import { coachWorkout, openReviewCount, openReviews } from './repo/coach';
import { home, portfolio } from './repo/portfolio';
import { openConversation, sendMessage } from './commands/messages';
import { TIME_ZONE } from './db/fixtures';
import { todayIn, weekStart } from '@coachos/domain';

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

  // D-088 : « Peux-tu faire tes séances à 100 % en ce moment ? », sans le corps.
  it('pas à 100 % : retour en tête de la file, repère et filtre ; « oui » le remet à sa place ; réponse fermée', async () => {
    const r = await saveFeedback(fbMeta(SEED_WORKOUTS.camilleToday), { publishedRevision: 1, expectedRevision: 2, state: 'completed', rpe: 5, readiness: 'not_quite' });
    expect(r.body).toMatchObject({ item: { readiness: 'not_quite' } });
    const q = await openReviews(USERS.marine, WORKSPACE_A);
    expect(q[0]).toMatchObject({ workoutId: SEED_WORKOUTS.camilleToday, readiness: 'not_quite' });
    const f = parseReviewFilter({ seulement: 'pas-a-100' });
    expect(q.filter((x) => matchesReviewFilter(x, f)).map((x) => x.workoutId)).toEqual([SEED_WORKOUTS.camilleToday]);
    expect(reviewFilterQuery(f)).toBe('?seulement=pas-a-100');
    await saveFeedback(fbMeta(SEED_WORKOUTS.camilleToday), { publishedRevision: 1, expectedRevision: 3, state: 'completed', rpe: 5, readiness: 'full' });
    const after = await openReviews(USERS.marine, WORKSPACE_A);
    expect(after.find((x) => x.workoutId === SEED_WORKOUTS.camilleToday)!.readiness).toBe('full');
    expect(after.filter((x) => matchesReviewFilter(x, f))).toEqual([]);
    expect(await codeOf(saveFeedback(fbMeta(SEED_WORKOUTS.camilleToday), { publishedRevision: 1, expectedRevision: 4, state: 'completed', readiness: 'genou' }))).toBe('INVALID_FIELDS');
  });

  // D-089 : suivi automatique « En parler avec l’élève », clos par un message du coach.
  it('« pas à 100 % » → « En parler avec l’élève » dans le Planning et repère dans Élèves ; un message du coach le clôt', async () => {
    const cid = (await openConversation({ actorId: USERS.marine, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille } as never)).body as { id: string };
    await sendMessage({ actorId: USERS.marine, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, conversationId: cid.id } as never, { body: 'Avant ton retour' });
    await saveFeedback(fbMeta(SEED_WORKOUTS.camilleToday), { publishedRevision: 1, expectedRevision: 4, state: 'completed', readiness: 'no' });
    const monday = weekStart(todayIn(TIME_ZONE));
    let h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, monday);
    const t = h.tasks.find((x) => x.rule === 'readiness_talk' && x.athlete?.id === ATHLETES.camille);
    expect(t).toMatchObject({ title: 'En parler avec l’élève', priority: 3 });
    expect(t!.reason).toMatch(/« Non »/);
    expect((await portfolio(USERS.marine, WORKSPACE_A, TIME_ZONE)).roster.find((a) => a.id === ATHLETES.camille)!.readiness).toMatchObject({ value: 'no' });
    await sendMessage({ actorId: USERS.marine, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, conversationId: cid.id } as never, { body: 'On en parle ce soir ?' });
    h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, monday);
    expect(h.tasks.some((x) => x.rule === 'readiness_talk' && x.athlete?.id === ATHLETES.camille)).toBe(false);
  });

  // D-090 : chrono d’un test saisi par l’élève, lu par le coach ; refusé pour une séance non réalisée.
  it('chrono du test enregistré avec le retour et lu par le coach', async () => {
    const r = await saveFeedback(fbMeta(SEED_WORKOUTS.camilleToday), { publishedRevision: 1, expectedRevision: 5, state: 'completed', testSeconds: 1500 });
    expect(r.body).toMatchObject({ item: { testSeconds: 1500 } });
    const w = await coachWorkout(USERS.marine, WORKSPACE_A, ATHLETES.camille, SEED_WORKOUTS.camilleToday);
    expect(w?.feedback?.testSeconds).toBe(1500);
    expect(await codeOf(saveFeedback(fbMeta(SEED_WORKOUTS.camilleToday), { publishedRevision: 1, expectedRevision: 6, state: 'missed', testSeconds: 1500 }))).toBe('INVALID_FIELDS');
  });
});
