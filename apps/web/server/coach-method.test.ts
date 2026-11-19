import { randomUUID } from 'node:crypto';
import { addDays, EMPTY_METHOD, todayIn, weekStart, type Block } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createGoal } from './commands/portfolio';
import { decideGoal } from './commands/goal-decisions';
import { saveAthleteProfile, saveBilanByCoach } from './commands/athlete-profile';
import { buildProgram, createProgram, nextMonday, programContext } from './commands/programs';
import { updateWorkout } from './commands/workouts';
import { methodCandidates, readCoachMethod, saveCoachMethod } from './commands/coach-method';

// D-072 : méthode du coach (versions, règles appliquées par le générateur, propositions apprises des retouches).

const meta = (actorId: string, extra: object = {}) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, ...extra }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const today = todayIn(TIME_ZONE);
const event = addDays(weekStart(today), 7 * 12 + 6);
const goals: Record<string, string> = {};
const dow = (d: string) => ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

beforeAll(async () => {
  setDb(await openDatabase());
  const bilan = { sport: 'running', level: 'intermediate', experience: '1to3', weeklySessions: '2to3', practiceStatus: 'regular', longestRecent: '45to60', availableDays: [2, 4, 6, 7] };
  await saveAthleteProfile(meta(USERS.noah), bilan);
  await saveBilanByCoach(meta(USERS.marine, { athleteId: ATHLETES.camille }), { expectedRevision: null, data: bilan });
  for (const aid of [ATHLETES.noah, ATHLETES.camille]) {
    const g = await createGoal(meta(USERS.marine, { athleteId: aid }), { title: 'Semi', sport: 'running', targetDate: event });
    goals[aid] = (g.body as { item: { id: string } }).item.id;
    await decideGoal(meta(USERS.marine, { athleteId: aid, goalId: goals[aid] }), { statusAtDecision: 'ambitious', params: { distanceKm: 21.1, eventDate: event, targetSeconds: null, weeklySessions: '4to5', weeklyHours: '4to6' } });
    await createProgram(meta(USERS.marine, { athleteId: aid, goalId: goals[aid] }), { startMonday: nextMonday(today), days: [2, 4, 6, 7], acceptRisks: true });
  }
});

describe('méthode du coach (D-072)', () => {
  it('versions : création, conflit, coach seulement ; validation des règles', async () => {
    expect(await readCoachMethod(USERS.marine, WORKSPACE_A)).toMatchObject({ version: 0, method: EMPTY_METHOD });
    await saveCoachMethod(meta(USERS.marine), { expectedVersion: 0, method: { ...EMPTY_METHOD, philosophy: 'La régularité avant l’intensité.', style: 'pedagogique' }, reason: 'Philosophie et style' });
    expect(await codeOf(saveCoachMethod(meta(USERS.marine), { expectedVersion: 0, method: EMPTY_METHOD }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(saveCoachMethod(meta(USERS.camille), { expectedVersion: 0, method: EMPTY_METHOD }))).not.toBe('OK');
    expect(await codeOf(saveCoachMethod(meta(USERS.marine), { expectedVersion: 1, method: { ...EMPTY_METHOD, rules: [{ id: randomUUID(), kind: 'volume_pct', pct: 150, source: 'manual', scope: {} }] } }))).toBe('INVALID_FIELDS');
    const v = await readCoachMethod(USERS.marine, WORKSPACE_A);
    expect(v).toMatchObject({ version: 1, method: { philosophy: 'La régularité avant l’intensité.' } });
    expect(v.history[0]).toMatchObject({ version: 1, reason: 'Philosophie et style' });
    expect((await readCoachMethod(USERS.camille, WORKSPACE_A)).version).toBe(0); // la méthode d’un coach n’est visible que de lui
  });

  it('6 retouches (longue déplacée au samedi, 2 élèves × 3 semaines) → proposition ; acceptée, le générateur l’applique', async () => {
    // Retouche : la sortie longue des 3 premières semaines passe du dimanche au samedi.
    for (const aid of [ATHLETES.noah, ATHLETES.camille]) {
      const rows = await readAs(USERS.marine, (tx) => tx.query<{ id: string; working_revision: number; local_date: string; title: string; intervals: Block[]; instructions: string }>(
        `select w.id, w.working_revision, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.title, r.intervals, r.instructions
         from public.workouts w join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
         where w.athlete_id = $1 and w.plan_id is not null and r.title like 'Sortie longue%' order by r.local_date limit 3`, [aid]));
      for (const r of rows.rows) {
        await updateWorkout(meta(USERS.marine, { athleteId: aid, workoutId: r.id }), { expectedRevision: r.working_revision, data: {
          localDate: addDays(r.local_date, -1), timeZone: TIME_ZONE, sortOrder: 1, sport: 'running', title: r.title, instructions: r.instructions || null, durationSeconds: null, distanceM: null, intervals: r.intervals } });
      }
    }
    let view = await readCoachMethod(USERS.marine, WORKSPACE_A);
    const cands = await methodCandidates(USERS.marine, WORKSPACE_A, view.method);
    const c = cands.find((x) => x.key === 'long_day:6')!;
    expect(c).toMatchObject({ support: 6, weeks: 3, athletes: 2, counter: 0, rule: { kind: 'long_day', day: 6, scope: { level: 'intermediate', sport: 'running' } } });
    expect(await methodCandidates(USERS.camille, WORKSPACE_A, EMPTY_METHOD)).toEqual([]);

    // Acceptée : nouvelle version, règle « apprise » ; elle n’est plus proposée ; le générateur l’applique.
    await saveCoachMethod(meta(USERS.marine), { expectedVersion: view.version, reason: 'Règle apprise acceptée', method: { ...view.method, rules: [{ ...c.rule, id: randomUUID(), source: 'learned', support: c.support }] } });
    view = await readCoachMethod(USERS.marine, WORKSPACE_A);
    expect(view.method.rules[0]).toMatchObject({ kind: 'long_day', day: 6, source: 'learned', support: 6 });
    expect((await methodCandidates(USERS.marine, WORKSPACE_A, view.method)).some((x) => x.key === 'long_day:6')).toBe(false);
    const ctx = (await programContext(USERS.marine, WORKSPACE_A, ATHLETES.noah, goals[ATHLETES.noah]!))!;
    expect(ctx.methodLines).toEqual(['sortie longue le samedi, pour les intermédiaires en course à pied']);
    const p = buildProgram(ctx, nextMonday(today), [2, 4, 6, 7])!;
    expect(p.weeks.slice(0, -1).flatMap((w) => w.sessions.filter((s) => s.kind === 'long')).every((s) => dow(s.date) === 6)).toBe(true);
    // Un réglage du programme reste prioritaire.
    const q = buildProgram(ctx, nextMonday(today), [2, 4, 6, 7], { maxQualityPerWeek: null, avoidQuality: [], volumePct: null, longProgressive: false, longDay: 7 })!;
    expect(q.weeks[0]!.sessions.find((s) => s.kind === 'long')!.date).toBe(addDays(nextMonday(today), 6));
    // Une autre coach (Camille n’est pas coach) n’a aucune règle : sa vue reste vide.
    expect((await readCoachMethod(USERS.camille, WORKSPACE_A)).method.rules).toEqual([]);
  });

  it('proposition écartée : elle ne revient pas', async () => {
    const view = await readCoachMethod(USERS.marine, WORKSPACE_A);
    const method = { ...view.method, rules: [], dismissed: ['long_day:6'] };
    await saveCoachMethod(meta(USERS.marine), { expectedVersion: view.version, method, reason: 'Proposition écartée' });
    expect(await methodCandidates(USERS.marine, WORKSPACE_A, (await readCoachMethod(USERS.marine, WORKSPACE_A)).method)).toEqual([]);
  });
});
