import { randomUUID } from 'node:crypto';
import { addDays, parseNotation, todayIn, weekStart, type Block } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createWorkout, publishWorkouts } from './commands/workouts';
import { applyWeekProposal, weekProposals } from './commands/week-proposals';
import { coachWeek } from './repo/coach';
import { athleteSchedule } from './repo/athlete';

// D-056 (CE-P-05) : propositions d’adaptation, appliquées en brouillons ; publication séparée.

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.noah });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const monday = addDays(weekStart(todayIn(TIME_ZONE)), 14);
const blocks = (t: string) => parseNotation(t, 'running').blocks as Block[];
const plan: [number, string, string][] = [
  [1, 'Fractionné', "15' Z1 + 5×(400m Z6 + R1') + 10' Z1"], [3, 'Seuil', "15' Z1 + 3×(6' Z4 + R2') + 10' Z1"],
  [5, 'Footing', "50' Z2"], [6, 'Sortie longue', "80' Z2"],
];
const ids: string[] = [];

beforeAll(async () => {
  setDb(await openDatabase());
  for (const [d, title, n] of plan) {
    const r = await createWorkout(meta(USERS.marine), { data: { localDate: addDays(monday, d), timeZone: TIME_ZONE, sport: 'running', title, intervals: blocks(n) } });
    ids.push((r.body as { id: string }).id);
  }
  // La sortie longue est déjà publiée : l’élève doit garder cette version jusqu’à la republication.
  await publishWorkouts({ ...meta(USERS.marine) }, { changes: [{ id: ids[3]!, revision: 1 }] });
});

describe('propositions d’adaptation de la semaine', () => {
  it('quatre propositions calculées pour le coach affecté seulement', async () => {
    const r = await weekProposals(USERS.marine, WORKSPACE_A, ATHLETES.noah, monday);
    expect(r!.proposals.map((p) => p.kind)).toEqual(['recovery', 'lighter', 'endurance', 'restart']);
    expect(r!.proposals.every((p) => p.afterSeconds < p.beforeSeconds)).toBe(true);
    expect(await weekProposals(USERS.noah, WORKSPACE_A, ATHLETES.noah, monday)).toBeNull();
    expect(await weekProposals(USERS.hugo, WORKSPACE_A, ATHLETES.noah, monday)).toBeNull();
  });

  it('appliquer « récupération » : nouvelles révisions, une séance retirée, version publiée intacte côté élève', async () => {
    const before = (await weekProposals(USERS.marine, WORKSPACE_A, ATHLETES.noah, monday))!;
    const seen = before.sessions.map((s) => ({ id: s.id, revision: s.revision }));
    expect(await codeOf(applyWeekProposal(meta(USERS.noah), { monday, kind: 'recovery', seen }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(applyWeekProposal(meta(USERS.marine), { monday: addDays(monday, 1), kind: 'recovery', seen }))).toBe('INVALID_FIELDS');
    const r = await applyWeekProposal(meta(USERS.marine), { monday, kind: 'recovery', seen });
    const updated = (r.body as { updated: { workoutId: string; revision: number; canceled: boolean }[] }).updated;
    expect(updated).toHaveLength(4);
    expect(updated.filter((u) => u.canceled).map((u) => u.workoutId)).toEqual([ids[0]]);
    const week = await coachWeek(USERS.marine, WORKSPACE_A, ATHLETES.noah, monday, addDays(monday, 6));
    expect(week.find((w) => w.id === ids[1])!.title).toMatch(/^Footing \d+′$/);
    expect(week.find((w) => w.id === ids[3])!.status).toBe('changed');
    const seenByAthlete = await athleteSchedule(USERS.noah, WORKSPACE_A, ATHLETES.noah, monday, addDays(monday, 6));
    expect(seenByAthlete.map((w) => w.title)).toEqual(['Sortie longue']);

    // Même aperçu rejoué après changement : la semaine a changé → conflit, rien d’appliqué.
    expect(await codeOf(applyWeekProposal(meta(USERS.marine), { monday, kind: 'lighter', seen }))).toBe('CONFLICT_OR_QUOTA');
  });
});
