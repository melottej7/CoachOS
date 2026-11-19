import { randomUUID } from 'node:crypto';
import { addDays, todayIn, weekStart } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createGoal } from './commands/portfolio';
import { decideGoal } from './commands/goal-decisions';
import { saveAthleteProfile } from './commands/athlete-profile';
import { buildProgram, createProgram, nextMonday, programContext } from './commands/programs';
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
    await decideGoal(meta(USERS.marine, { goalId: goal }), { statusAtDecision: 'ambitious', params: { distanceKm: 21.1, eventDate: event, targetSeconds: 7200, weeklySessions: '4to5', weeklyHours: '4to6' } });
    const ctx = (await programContext(USERS.marine, WORKSPACE_A, ATHLETES.noah, goal))!;
    const program = buildProgram(ctx, nextMonday(today), [2, 4, 6, 7])!;
    const needsAccept = program.risks.some((r) => r.level !== 'watch');
    if (needsAccept) expect(await codeOf(createProgram(meta(USERS.marine, { goalId: goal }), { startMonday: nextMonday(today), days: [2, 4, 6, 7] }))).toBe('INVALID_FIELDS');
    expect(await codeOf(createProgram(meta(USERS.marine, { goalId: goal }), { startMonday: addDays(nextMonday(today), 1), days: [2, 4, 6, 7], acceptRisks: true }))).toBe('INVALID_FIELDS');
    expect(await codeOf(createProgram(meta(USERS.camille, { goalId: goal }), { startMonday: nextMonday(today), days: [2, 4, 6, 7], acceptRisks: true }))).toBe('RESOURCE_NOT_VISIBLE');
    const r = await createProgram(meta(USERS.marine, { goalId: goal }), { startMonday: nextMonday(today), days: [2, 4, 6, 7], acceptRisks: true });
    const body = r.body as { planId: string; workouts: number; weeks: number };
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
  });
});
