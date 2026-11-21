import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { openConversation, sendMessage } from './commands/messages';
import { createWorkout, publishWorkouts } from './commands/workouts';
import { addDays, todayIn } from '@coachos/domain';
import { relances } from './repo/relances';
import { readRelanceTemplates, saveRelanceTemplate } from './commands/relance-templates';
import { AppError } from './errors';

// D-103 : relances calculées pour les élèves suivis par le coach connecté, jamais pour un autre coach ni un élève.

async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A });

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('relances', () => {
  it('une ligne par élève suivi, avec statut et brouillon ; rien pour un autre coach ni un élève', async () => {
    const rows = await relances(USERS.marine, WORKSPACE_A);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.reason && ['silent', 'at_risk', 'watch', 'on_track', 'no_plan'].includes(r.status))).toBe(true);
    for (const r of rows) {
      if (r.relance) expect(r.draft).toContain(r.first);
      else expect(r.draft).toBeNull();
    }
    expect(await relances(USERS.hugo, WORKSPACE_A)).toEqual([]);
    expect(await relances(USERS.camille, WORKSPACE_A)).toEqual([]);
  });

  it('séance passée sans retour : à surveiller, brouillon qui la nomme ; après le message du coach, en attente de réponse', async () => {
    const day = addDays(todayIn(TIME_ZONE), -3);
    const w = await createWorkout({ ...meta(USERS.marine), athleteId: ATHLETES.camille }, { data: { localDate: day, timeZone: TIME_ZONE, sport: 'running', title: 'Côtes 8 × 30″', durationSeconds: 2400, instructions: null } });
    const sid = ((w.body as { item?: { id: string } }).item?.id ?? (w.body as { id: string }).id);
    await publishWorkouts({ ...meta(USERS.marine), athleteId: ATHLETES.camille }, { changes: [{ id: sid, revision: 1 }] });
    const before = (await relances(USERS.marine, WORKSPACE_A)).find((r) => r.athleteId === ATHLETES.camille)!;
    expect(before).toMatchObject({ status: 'watch', relance: 'no_feedback', waitingSince: null, reason: 'Pas de retour sur « Côtes 8 × 30″ »' });
    expect(before.draft).toContain('« Côtes 8 × 30″ »');
    const c = await openConversation({ ...meta(USERS.marine), athleteId: ATHLETES.camille });
    const cid = (c.body as { id: string }).id;
    await sendMessage({ ...meta(USERS.marine), conversationId: cid }, { body: before.draft!, workoutId: sid });
    const after = (await relances(USERS.marine, WORKSPACE_A)).find((r) => r.athleteId === ATHLETES.camille)!;
    expect(after).toMatchObject({ status: 'watch', relance: 'no_feedback', waitingSince: todayIn(TIME_ZONE) });
  });

  it('modèle du coach : utilisé pour ses relances, rétabli sur demande ; personnel et réservé aux coachs', async () => {
    await saveRelanceTemplate(meta(USERS.marine), { kind: 'no_feedback', body: 'Alors {prénom}, cette « {séance} » ? 🐢' });
    const row = (await relances(USERS.marine, WORKSPACE_A)).find((r) => r.relance === 'no_feedback');
    expect(row).toBeDefined();
    expect(row!.draft).toBe(`Alors ${row!.first}, cette « ${row!.workout!.title} » ? 🐢`);
    expect(await readRelanceTemplates(USERS.marine, WORKSPACE_A)).toEqual({ no_feedback: 'Alors {prénom}, cette « {séance} » ? 🐢' });
    expect(await readRelanceTemplates(USERS.hugo, WORKSPACE_A)).toEqual({});
    expect(await codeOf(saveRelanceTemplate(meta(USERS.camille), { kind: 'silent', body: 'x' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(saveRelanceTemplate(meta(USERS.marine), { kind: 'autre', body: 'x' }))).toBe('INVALID_FIELDS');
    await saveRelanceTemplate(meta(USERS.marine), { kind: 'no_feedback', body: null });
    expect(await readRelanceTemplates(USERS.marine, WORKSPACE_A)).toEqual({});
  });
});

