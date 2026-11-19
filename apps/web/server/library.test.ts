import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { addStarterLibrary, createTemplate, templateFromWorkout, updateTemplate } from './commands/library';
import { listLibrary, readTemplate } from './repo/library';

// Bibliothèque de séances (D-035).

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const workout = { sport: 'running', title: '  Fractionné 10 × 400 m ', intervals: [{ type: 'repeat', times: 10, steps: [{ type: 'step', phase: 'work', measure: { kind: 'distance', meters: 400 }, intensity: { kind: 'zone', zone: 6 } }] }] };

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('bibliothèque de séances', () => {
  it('le coach crée, modifie et archive ; révision attendue ; personne d’autre n’y touche', async () => {
    const r = await createTemplate(meta(USERS.marine), { category: 'intervals', workout });
    const { id } = r.body as { id: string };
    expect((await readTemplate(USERS.marine, WORKSPACE_A, id))?.workout.title).toBe('Fractionné 10 × 400 m');
    expect(await readTemplate(USERS.hugo, WORKSPACE_A, id)).toBeNull();
    expect(await readTemplate(USERS.camille, WORKSPACE_A, id)).toBeNull();
    expect(await codeOf(createTemplate(meta(USERS.camille), { workout }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(updateTemplate({ ...meta(USERS.marine), templateId: id }, { expectedRevision: 9, category: 'tempo' }))).toBe('CONFLICT_OR_QUOTA');
    await updateTemplate({ ...meta(USERS.marine), templateId: id }, { expectedRevision: 1, workout: { ...workout, title: '12 × 400 m' } });
    expect((await readTemplate(USERS.marine, WORKSPACE_A, id))?.workout.title).toBe('12 × 400 m');
    await updateTemplate({ ...meta(USERS.marine), templateId: id }, { expectedRevision: 2, archive: true });
    expect((await listLibrary(USERS.marine, WORKSPACE_A)).some((t) => t.id === id)).toBe(false);
  });

  it('séances de départ ajoutées une seule fois ; une séance d’élève entre dans la bibliothèque', async () => {
    const first = (await addStarterLibrary(meta(USERS.marine))).body as { added: number };
    expect(first.added).toBeGreaterThan(5);
    expect(((await addStarterLibrary(meta(USERS.marine))).body as { added: number }).added).toBe(0);
    const t = (await templateFromWorkout({ ...meta(USERS.marine), athleteId: ATHLETES.camille, workoutId: SEED_WORKOUTS.camilleYesterday }, { category: 'endurance' })).body as { id: string };
    expect((await readTemplate(USERS.marine, WORKSPACE_A, t.id))).toMatchObject({ category: 'endurance', workout: { title: 'Endurance fondamentale' } });
    expect(await codeOf(templateFromWorkout({ ...meta(USERS.hugo), athleteId: ATHLETES.camille, workoutId: SEED_WORKOUTS.camilleYesterday }, {}))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
