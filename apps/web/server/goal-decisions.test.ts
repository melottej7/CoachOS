import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createGoal, updateGoal } from './commands/portfolio';
import { decideGoal, readGoalDecisions } from './commands/goal-decisions';
import { athleteFile } from './repo/portfolio';

// D-058 : la décision du coach sur un objectif, contrainte du futur programme ; jamais lisible par l’élève.

const meta = (actorId: string, extra: object = {}) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, ...extra }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const params = { distanceKm: 42.2, eventDate: '2027-01-17', targetSeconds: 13500, weeklySessions: '4to5', weeklyHours: '6to10' };
let goal = '';

beforeAll(async () => {
  setDb(await openDatabase());
  const r = await createGoal(meta(USERS.marine, { athleteId: ATHLETES.camille }), { title: 'Marathon de Séville en 3h45', sport: 'running', targetDate: '2027-01-17' });
  goal = (r.body as { id?: string; item?: { id: string } }).id ?? (r.body as { item: { id: string } }).item.id;
});

describe('décision du coach sur un objectif', () => {
  it('le coach valide un objectif jugé risqué, avec sa justification ; l’élève ne la voit pas', async () => {
    const r = await decideGoal(meta(USERS.marine, { athleteId: ATHLETES.camille, goalId: goal }), { statusAtDecision: 'risky', params, note: 'A déjà couru 3 marathons en 3h50.' });
    expect(r.body).toMatchObject({ item: { goalId: goal, statusAtDecision: 'risky', note: 'A déjà couru 3 marathons en 3h50.', revision: 1 } });
    expect(await readGoalDecisions(USERS.marine, WORKSPACE_A, ATHLETES.camille)).toHaveLength(1);
    expect(await readGoalDecisions(USERS.camille, WORKSPACE_A, ATHLETES.camille)).toHaveLength(0);
    expect((await readAs(USERS.camille, (tx) => tx.query('select 1 from public.goal_decisions'))).rows).toHaveLength(0);
  });

  it('ajustement : la date validée peut être reportée sur l’objectif ; nouvelle révision', async () => {
    await decideGoal(meta(USERS.marine, { athleteId: ATHLETES.camille, goalId: goal }), { statusAtDecision: 'ambitious', params: { ...params, eventDate: '2027-04-04' }, applyDate: true });
    const [d] = await readGoalDecisions(USERS.marine, WORKSPACE_A, ATHLETES.camille);
    expect(d).toMatchObject({ revision: 2, statusAtDecision: 'ambitious', params: { eventDate: '2027-04-04' }, note: null });
    const file = await athleteFile(USERS.marine, WORKSPACE_A, ATHLETES.camille, 'Europe/Brussels');
    expect(file.goals.find((g) => g.id === goal)!.targetDate).toBe('2027-04-04');
  });

  it('refus : élève, autre espace, autre élève, objectif terminé, paramètres invalides', async () => {
    const body = { statusAtDecision: 'risky', params };
    expect(await codeOf(decideGoal(meta(USERS.camille, { athleteId: ATHLETES.camille, goalId: goal }), body))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(decideGoal(meta(USERS.hugo, { athleteId: ATHLETES.camille, goalId: goal }), body))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(decideGoal(meta(USERS.marine, { athleteId: ATHLETES.noah, goalId: goal }), body))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(decideGoal(meta(USERS.marine, { athleteId: ATHLETES.camille, goalId: goal }), { ...body, params: { ...params, distanceKm: -1 } }))).toBe('INVALID_FIELDS');
    await updateGoal(meta(USERS.marine, { athleteId: ATHLETES.camille, goalId: goal }), { state: 'achieved' });
    expect(await codeOf(decideGoal(meta(USERS.marine, { athleteId: ATHLETES.camille, goalId: goal }), body))).toBe('INVALID_FIELDS');
  });
});
