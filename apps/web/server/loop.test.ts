import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { addDays, todayIn } from '@coachos/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { postgresDb } from './db/driver';
import { repoRoot } from './db/migrate';
import { clearData, seed } from './db/seed';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { createWorkout, publishWorkouts, updateWorkout } from './commands/workouts';
import { markFeedbackReviewed, saveFeedback } from './commands/feedback';
import { coachWeek, coachWorkout, openReviewCount, openReviews } from './repo/coach';
import { athleteSchedule, athleteWorkout } from './repo/athlete';

// Boucle à deux rôles et cas d’autorisation : coach A, coach B (autre espace),
// athlète affecté (Camille) et athlète tiers (Léa, autre espace).

let db: Db;
// Par défaut : PGlite en mémoire. COACHOS_TEST_PG=1 : même suite sur le PostgreSQL de Supabase local
// (recharge le jeu fictif ; relancer `npm run supabase:seed` n’est pas nécessaire ensuite).
const onPostgres = process.env.COACHOS_TEST_PG === '1';
const today = todayIn(TIME_ZONE);
const meta = (actorId: string, extra: Record<string, string> = {}) => ({
  actorId,
  workspaceId: WORKSPACE_A,
  athleteId: ATHLETES.camille,
  idempotencyKey: randomUUID(),
  requestId: randomUUID(),
  ...extra,
});
const input = (title: string, localDate = today) => ({
  data: { localDate, timeZone: TIME_ZONE, sport: 'running', title, durationSeconds: 1800, instructions: 'Facile.' },
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
  if (onPostgres) {
    process.loadEnvFile(path.join(repoRoot(), 'apps', 'web', '.env.local'));
    const url = process.env.DATABASE_URL ?? '';
    if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error('COACHOS_TEST_PG vise uniquement Supabase local');
    const { supabaseAuthUsers } = await import('./supabase/admin');
    db = postgresDb(url);
    await clearData(db, { deleteAuthUsers: false });
    await seed(db, { ensureAuthUsers: supabaseAuthUsers });
  } else {
    db = await openDatabase(); // mémoire
  }
  setDb(db);
});

afterAll(async () => {
  if (onPostgres) {
    // Laisser la base de démonstration propre après la suite.
    const { supabaseAuthUsers } = await import('./supabase/admin');
    await clearData(db, { deleteAuthUsers: false });
    await seed(db, { ensureAuthUsers: supabaseAuthUsers });
    await db.close();
  }
});

describe('tranche A · publier et lire', () => {
  let workoutId = '';

  it('le coach crée un brouillon invisible pour l’athlète (C04-04)', async () => {
    const r = await createWorkout(meta(USERS.marine), input('Seuil court'));
    expect(r.status).toBe(201);
    workoutId = (r.body as { id: string }).id;
    const week = await coachWeek(USERS.marine, WORKSPACE_A, ATHLETES.camille, today, today);
    expect(week.find((w) => w.id === workoutId)?.status).toBe('draft');
    expect(await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, workoutId)).toBeNull();
    const schedule = await athleteSchedule(USERS.camille, WORKSPACE_A, ATHLETES.camille, today, today);
    expect(schedule.map((w) => w.id)).not.toContain(workoutId);
  });

  it('un coach d’un autre espace ne peut ni lire ni écrire le dossier', async () => {
    expect(await codeOf(createWorkout(meta(USERS.hugo), input('Intrusion')))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await coachWeek(USERS.hugo, WORKSPACE_A, ATHLETES.camille, addDays(today, -7), addDays(today, 7))).toEqual([]);
    expect(await codeOf(publishWorkouts(meta(USERS.hugo), { changes: [{ id: workoutId, revision: 1 }] }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('l’athlète ne peut pas créer de séance', async () => {
    expect(await codeOf(createWorkout(meta(USERS.camille), input('Auto-prescription')))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('publier rend la séance visible, une seule fois malgré le double clic (C05-01, C06-01)', async () => {
    const m = meta(USERS.marine);
    const body = { changes: [{ id: workoutId, revision: 1 }] };
    const [a, b] = [await publishWorkouts(m, body), await publishWorkouts(m, body)];
    expect(b).toEqual(a);
    await publishWorkouts(meta(USERS.marine), body); // autre clé, même version : aucun doublon
    const items = await db.query<{ n: number }>('select count(*)::int as n from public.publication_items where workout_id = $1', [workoutId]);
    expect(items.rows[0]!.n).toBe(1);
    const seen = await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, workoutId);
    expect(seen?.workout.title).toBe('Seuil court');
  });

  it('l’athlète tiers ne voit pas la séance publiée', async () => {
    expect(await athleteWorkout(USERS.lea, WORKSPACE_A, ATHLETES.camille, workoutId)).toBeNull();
    expect(await athleteSchedule(USERS.noah, WORKSPACE_A, ATHLETES.camille, today, today)).toEqual([]);
  });

  it('une modification reste en brouillon tant qu’elle n’est pas republiée', async () => {
    await updateWorkout({ ...meta(USERS.marine), workoutId }, { expectedRevision: 1, ...input('Seuil court modifié') });
    const detail = await coachWorkout(USERS.marine, WORKSPACE_A, ATHLETES.camille, workoutId);
    expect(detail?.status).toBe('changed');
    expect(detail?.published?.title).toBe('Seuil court');
    const seen = await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, workoutId);
    expect(seen?.workout).toMatchObject({ title: 'Seuil court', revision: 1 });
  });

  it('une révision périmée est refusée sans rien publier', async () => {
    const r = await codeOf(publishWorkouts(meta(USERS.marine), { changes: [{ id: workoutId, revision: 1 }] }));
    expect(r).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(updateWorkout({ ...meta(USERS.marine), workoutId }, { expectedRevision: 1, ...input('x') }))).toBe('CONFLICT_OR_QUOTA');
  });

  it('même clé avec un autre contenu : 409', async () => {
    const m = meta(USERS.marine);
    await createWorkout(m, input('A'));
    expect(await codeOf(createWorkout(m, input('B')))).toBe('CONFLICT_OR_QUOTA');
  });
});

describe('tranche B · retour et revue', () => {
  const sid = SEED_WORKOUTS.camilleToday;
  const fb = { publishedRevision: 1, expectedRevision: null, state: 'completed', durationSeconds: 2100, rpe: 5, comment: 'Bien.' };

  it('l’athlète envoie un retour, rejoué une seule fois après coupure réseau (C06-02, C06-07)', async () => {
    const before = await openReviewCount(USERS.marine, WORKSPACE_A);
    const m = { ...meta(USERS.camille), workoutId: sid };
    const first = await saveFeedback(m, fb);
    const replay = await saveFeedback(m, fb);
    expect(replay).toEqual(first);
    const rows = await db.query<{ n: number }>('select count(*)::int as n from public.workout_results where workout_id = $1', [sid]);
    expect(rows.rows[0]!.n).toBe(1);
    expect(await openReviewCount(USERS.marine, WORKSPACE_A)).toBe(before + 1);
    const seen = await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, sid);
    expect(seen?.feedback).toMatchObject({ state: 'completed', durationSeconds: 2100, rpe: 5, revision: 1 });
  });

  it('un second premier envoi depuis un autre appareil reçoit un conflit', async () => {
    expect(await codeOf(saveFeedback({ ...meta(USERS.camille), workoutId: sid }, fb))).toBe('CONFLICT_OR_QUOTA');
  });

  it('ni coach, ni athlète tiers ne peuvent écrire le retour de Camille', async () => {
    expect(await codeOf(saveFeedback({ ...meta(USERS.marine), workoutId: sid }, fb))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(saveFeedback({ ...meta(USERS.lea), workoutId: sid }, fb))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('pas de retour sur un brouillon ni sur une séance future', async () => {
    expect(await codeOf(saveFeedback({ ...meta(USERS.camille), workoutId: SEED_WORKOUTS.camilleDraft }, fb))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(saveFeedback({ ...meta(USERS.camille), workoutId: SEED_WORKOUTS.camilleLong }, fb))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
  });

  it('une republication ne change pas la version observée (C06-08)', async () => {
    await updateWorkout({ ...meta(USERS.marine), workoutId: sid }, { expectedRevision: 1, ...input('Footing facile v2') });
    await publishWorkouts(meta(USERS.marine), { changes: [{ id: sid, revision: 2 }] });
    const detail = await coachWorkout(USERS.marine, WORKSPACE_A, ATHLETES.camille, sid);
    expect(detail?.feedback?.observedRevision).toBe(1);
    expect(detail?.published?.number).toBe(2);
    // L’athlète voit la nouvelle version et garde l’accès à son retour.
    const seen = await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, sid);
    expect(seen?.workout.revision).toBe(2);
    expect(seen?.feedback?.observedRevision).toBe(1);
  });

  it('le coach B ne voit pas la file du coach A', async () => {
    expect(await openReviews(USERS.hugo, WORKSPACE_A)).toEqual([]);
    expect(await codeOf(markFeedbackReviewed({ ...meta(USERS.hugo), workoutId: sid }, { expectedRevision: 1 }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('le coach traite le retour une seule fois et le compteur suit (C06-09, C09-01, C09-06)', async () => {
    const before = await openReviewCount(USERS.marine, WORKSPACE_A);
    const m = { ...meta(USERS.marine), workoutId: sid };
    const a = await markFeedbackReviewed(m, { expectedRevision: 1 });
    const b = await markFeedbackReviewed({ ...m, idempotencyKey: randomUUID() }, { expectedRevision: 1 });
    expect((b.body as { reviewedAt: string }).reviewedAt).toBe((a.body as { reviewedAt: string }).reviewedAt);
    expect(await openReviewCount(USERS.marine, WORKSPACE_A)).toBe(before - 1);
    const audits = await db.query<{ n: number }>(`select count(*)::int as n from public.audit_logs where action = 'feedback.reviewed'`);
    expect(audits.rows[0]!.n).toBe(1);
  });

  it('une correction de l’athlète rouvre le cas et périme la revue en cours', async () => {
    await saveFeedback({ ...meta(USERS.camille), workoutId: sid }, { ...fb, publishedRevision: 2, expectedRevision: 1, rpe: 7 });
    const queue = await openReviews(USERS.marine, WORKSPACE_A, ATHLETES.camille);
    expect(queue.some((q) => q.workoutId === sid)).toBe(true);
    expect(await codeOf(markFeedbackReviewed({ ...meta(USERS.marine), workoutId: sid }, { expectedRevision: 1 }))).toBe('CONFLICT_OR_QUOTA');
  });
});
