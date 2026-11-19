import { randomUUID } from 'node:crypto';
import { addDays, parseNotation, todayIn, weekStart } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createGoal } from './commands/portfolio';
import { decideGoal } from './commands/goal-decisions';
import { saveAthleteProfile } from './commands/athlete-profile';
import { buildProgram, buildRegeneration, createProgram, goalsAwaitingProgram, nextMonday, programContext, readGoalPlans, regenContext, regenerateProgram, seenOf } from './commands/programs';
import { publishWorkouts, updateWorkout } from './commands/workouts';
import { createTemplate } from './commands/library';
import { coachWeek } from './repo/coach';
import { athleteSchedule } from './repo/athlete';

// D-061 : programme généré pour un objectif validé ; brouillons ; risques acceptés par le coach.

const meta = (actorId: string, extra: object = {}) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.noah, ...extra }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const today = todayIn(TIME_ZONE);
const event = addDays(weekStart(today), 7 * 12 + 6); // dimanche de la 12e semaine
let goal = '';

beforeAll(async () => {
  setDb(await openDatabase());
  await saveAthleteProfile(meta(USERS.noah), { sport: 'running', level: 'intermediate', experience: '1to3', weeklySessions: '2to3', practiceStatus: 'regular', longestRecent: '45to60', availableDays: [2, 4, 6, 7] });
  const r = await createGoal(meta(USERS.marine), { title: 'Semi de printemps', sport: 'running', targetDate: event });
  goal = (r.body as { id?: string; item?: { id: string } }).id ?? (r.body as { item: { id: string } }).item.id;
  // D-062 : une séance de seuil de la bibliothèque de Marine, d’une durée proche de ce que le programme prévoit.
  await createTemplate(meta(USERS.marine), { category: 'threshold', workout: {
    sport: 'running', title: 'Seuil maison 3 × 8′', instructions: 'Régulier, sans finir à bloc.', durationSeconds: null, distanceM: null,
    intervals: parseNotation("10' Z1 + 3×(8' Z4 + R2') + 5' Z1", 'running').blocks } });
});

describe('générateur de programme (serveur)', () => {
  it('objectif non validé : aperçu possible, création refusée', async () => {
    const ctx = await programContext(USERS.marine, WORKSPACE_A, ATHLETES.noah, goal);
    expect(ctx!.decision).toBeNull();
    expect(buildProgram(ctx!, nextMonday(today), ctx!.defaultDays)!.weeks.length).toBeGreaterThan(4);
    expect(await codeOf(createProgram(meta(USERS.marine, { goalId: goal }), { startMonday: nextMonday(today), days: [2, 4, 6, 7] }))).toBe('INVALID_FIELDS');
    expect(await programContext(USERS.noah, WORKSPACE_A, ATHLETES.noah, goal)).toBeNull();
  });

  it('objectif validé : brouillons reliés au programme, invisibles pour l’élève ; risques à accepter', async () => {
    expect(await goalsAwaitingProgram(USERS.marine, WORKSPACE_A, ATHLETES.noah)).toEqual([]); // pas encore validé
    await decideGoal(meta(USERS.marine, { goalId: goal }), { statusAtDecision: 'ambitious', params: { distanceKm: 21.1, eventDate: event, targetSeconds: 7200, weeklySessions: '4to5', weeklyHours: '4to6' } });
    const ctx = (await programContext(USERS.marine, WORKSPACE_A, ATHLETES.noah, goal))!;
    // Objectif validé, sans programme : « Prochaine étape : générer le programme » (fiche et Séances).
    expect((await goalsAwaitingProgram(USERS.marine, WORKSPACE_A, ATHLETES.noah)).map((g) => g.id)).toEqual([goal]);
    expect(await goalsAwaitingProgram(USERS.camille, WORKSPACE_A, ATHLETES.noah)).toEqual([]);
    const program = buildProgram(ctx, nextMonday(today), [2, 4, 6, 7])!;
    const needsAccept = program.risks.some((r) => r.level !== 'watch');
    if (needsAccept) expect(await codeOf(createProgram(meta(USERS.marine, { goalId: goal }), { startMonday: nextMonday(today), days: [2, 4, 6, 7] }))).toBe('INVALID_FIELDS');
    expect(await codeOf(createProgram(meta(USERS.marine, { goalId: goal }), { startMonday: addDays(nextMonday(today), 1), days: [2, 4, 6, 7], acceptRisks: true }))).toBe('INVALID_FIELDS');
    expect(await codeOf(createProgram(meta(USERS.camille, { goalId: goal }), { startMonday: nextMonday(today), days: [2, 4, 6, 7], acceptRisks: true }))).toBe('RESOURCE_NOT_VISIBLE');
    const r = await createProgram(meta(USERS.marine, { goalId: goal }), { startMonday: nextMonday(today), days: [2, 4, 6, 7], acceptRisks: true });
    const body = r.body as { planId: string; workouts: number; weeks: number };
    expect(await goalsAwaitingProgram(USERS.marine, WORKSPACE_A, ATHLETES.noah)).toEqual([]); // programme créé : plus de « Prochaine étape »
    expect(body.weeks).toBe(program.weeks.length);
    expect(body.workouts).toBe(program.weeks.reduce((n, w) => n + w.sessions.length, 0));
    const week1 = await coachWeek(USERS.marine, WORKSPACE_A, ATHLETES.noah, nextMonday(today), addDays(nextMonday(today), 6));
    expect(week1.length).toBe(4);
    // La création produit exactement les séances de l’aperçu (mêmes dates et titres), semaine par semaine.
    for (const w of program.weeks) {
      const got = await coachWeek(USERS.marine, WORKSPACE_A, ATHLETES.noah, w.monday, addDays(w.monday, 6));
      expect(got.map((x) => `${x.localDate} ${x.title}`)).toEqual(w.sessions.map((x) => `${x.date} ${x.title}`));
    }
    expect(week1.every((w) => w.status === 'draft')).toBe(true);
    expect(await athleteSchedule(USERS.noah, WORKSPACE_A, ATHLETES.noah, nextMonday(today), event)).toEqual([]);
    const plans = await readAs(USERS.marine, (tx) => tx.query<{ goal_id: string; phases: string[] }>(
      `select p.goal_id, array_agg(b.phase order by b.starts_on) as phases from public.plans p join public.plan_blocks b on b.workspace_id = p.workspace_id and b.plan_id = p.id where p.id = $1 group by p.goal_id`, [body.planId]));
    expect(plans.rows[0]).toMatchObject({ goal_id: goal });
    expect(plans.rows[0]!.phases[0]).toBe('tremplin');
    expect(plans.rows[0]!.phases.at(-1)).toBe('affutage');
    expect((await readAs(USERS.noah, (tx) => tx.query('select 1 from public.plans'))).rows).toHaveLength(0);
    // D-062 : la séance de bibliothèque est reprise avec ses consignes ; chaque brouillon dit pourquoi il est là.
    expect(ctx.library.some((x) => x.title === 'Seuil maison 3 × 8′')).toBe(true);
    expect(program.weeks.some((w) => w.sessions.some((x) => x.source === 'library'))).toBe(true);
    const revs = await readAs(USERS.marine, (tx) => tx.query<{ title: string; instructions: string }>(
      `select r.title, r.instructions from public.workouts w join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision where w.plan_id = $1`, [body.planId]));
    expect(revs.rows.every((x) => x.instructions.includes('Pourquoi cette séance ?'))).toBe(true);
    expect(revs.rows.find((x) => x.title === 'Seuil maison 3 × 8′')!.instructions).toMatch(/Choisie dans ta bibliothèque[\s\S]*Régulier, sans finir à bloc\./);
  });

  it('régénération partielle (D-063) : semaines demandées seulement, retouches protégées, publiée = nouvelle version à publier', async () => {
    const plan = (await readGoalPlans(USERS.marine, WORKSPACE_A, ATHLETES.noah, goal))[0]!;
    expect(plan.days).toEqual([2, 4, 6, 7]);
    let rc = (await regenContext(USERS.marine, WORKSPACE_A, ATHLETES.noah, plan.id))!;
    expect(await regenContext(USERS.noah, WORKSPACE_A, ATHLETES.noah, plan.id)).toBeNull();
    const startMonday = rc.plan.startMonday;
    const wk = (n: number) => rc.old.filter((s) => s.date >= addDays(startMonday, (n - 1) * 7) && s.date <= addDays(startMonday, n * 7 - 1));
    // Mêmes jours : rien ne change.
    const same = buildRegeneration(rc, [2, 4, 6, 7], 1, 60)!;
    expect(same.regen.counts).toMatchObject({ changed: 0, added: 0, removed: 0 });
    // Le coach retouche une séance de la semaine 3 et publie la semaine 2.
    const mineW3 = wk(3)[0]!;
    await updateWorkout(meta(USERS.marine, { workoutId: mineW3.id }), { expectedRevision: 1, data: {
      localDate: mineW3.date, timeZone: TIME_ZONE, sortOrder: 0, sport: 'running', title: 'Footing retouché', instructions: null, durationSeconds: 1800, distanceM: null, intervals: [] } });
    await publishWorkouts(meta(USERS.marine), { changes: wk(2).map((s) => ({ id: s.id, revision: s.revision })) });
    rc = (await regenContext(USERS.marine, WORKSPACE_A, ATHLETES.noah, plan.id))!;
    const before = await athleteSchedule(USERS.noah, WORKSPACE_A, ATHLETES.noah, addDays(startMonday, 7), addDays(startMonday, 13));
    expect(before.length).toBe(4);
    // Semaines 2 à 3, nouveaux jours lundi, mercredi, samedi.
    const r = buildRegeneration(rc, [1, 3, 6], 2, 3)!;
    expect(r.regen.weeks.map((w) => w.index)).toEqual([2, 3]);
    const items = r.regen.weeks.flatMap((w) => w.items);
    expect(items.find((it) => it.kind === 'kept' && it.before.id === mineW3.id)).toMatchObject({ reason: 'edited' });
    // Aperçu périmé : refusé.
    expect(await codeOf(regenerateProgram(meta(USERS.marine, { planId: plan.id }), { fromWeek: 2, toWeek: 3, days: [1, 3, 6], seen: [], acceptRisks: true }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(regenerateProgram(meta(USERS.camille, { planId: plan.id }), { fromWeek: 2, toWeek: 3, days: [1, 3, 6], seen: seenOf(r.regen), acceptRisks: true }))).toBe('RESOURCE_NOT_VISIBLE');
    const done = await regenerateProgram(meta(USERS.marine, { planId: plan.id }), { fromWeek: 2, toWeek: 3, days: [1, 3, 6], seen: seenOf(r.regen), acceptRisks: true });
    expect(done.body).toMatchObject(r.regen.counts);
    // Semaines 1 et 4 intactes ; semaine 3 : la retouche reste.
    const after = (await regenContext(USERS.marine, WORKSPACE_A, ATHLETES.noah, plan.id))!;
    const live = (n: number) => after.old.filter((s) => !s.canceled && s.date >= addDays(startMonday, (n - 1) * 7) && s.date <= addDays(startMonday, n * 7 - 1));
    expect(live(1).map((s) => `${s.id}:${s.revision}`)).toEqual(wk(1).map((s) => `${s.id}:${s.revision}`));
    expect(live(4).map((s) => `${s.id}:${s.revision}`)).toEqual(wk(4).map((s) => `${s.id}:${s.revision}`));
    expect(live(3).some((s) => s.title === 'Footing retouché')).toBe(true);
    const dow = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7 + 1;
    expect(live(2).map((s) => dow(s.date))).toEqual([1, 3, 6]);
    // L’élève voit toujours la semaine 2 publiée telle quelle, jusqu’à la republication.
    expect(await athleteSchedule(USERS.noah, WORKSPACE_A, ATHLETES.noah, addDays(startMonday, 7), addDays(startMonday, 13))).toEqual(before);
    // Re-calcul identique ensuite : plus rien à changer dans ces semaines.
    expect(buildRegeneration(after, [1, 3, 6], 2, 3)!.regen.counts).toMatchObject({ changed: 0, added: 0, removed: 0 });
    expect((await readGoalPlans(USERS.marine, WORKSPACE_A, ATHLETES.noah, goal))[0]).toMatchObject({ days: [1, 3, 6], regenerations: 1 });
  });
});
