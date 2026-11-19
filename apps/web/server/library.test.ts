import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { addStarterLibrary, applyWeekTemplate, createTemplate, templateFromWorkout, updateTemplate, updateWeekTemplate, weekFromAthlete } from './commands/library';
import { listLibrary, listWeekTemplates, readTemplate } from './repo/library';
import { coachWeek } from './repo/coach';
import { athleteSchedule } from './repo/athlete';
import { addDays, todayIn, weekStart } from '@coachos/domain';
import { TIME_ZONE } from './db/fixtures';

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

  it('semaine type (D-051) : enregistrée depuis un élève, appliquée à un autre en brouillons, renommée puis archivée', async () => {
    const monday = weekStart(todayIn(TIME_ZONE));
    const camilleWeek = (await coachWeek(USERS.marine, WORKSPACE_A, ATHLETES.camille, monday, addDays(monday, 6))).filter((w) => !w.canceled);
    expect(camilleWeek.length).toBeGreaterThan(0);
    const r = await weekFromAthlete(meta(USERS.marine), { athleteId: ATHLETES.camille, monday, title: 'Semaine de reprise' });
    const t = r.body as { id: string; revision: number; sessions: number };
    expect(t.sessions).toBe(camilleWeek.length);
    const [tpl] = await listWeekTemplates(USERS.marine, WORKSPACE_A);
    expect(tpl).toMatchObject({ id: t.id, title: 'Semaine de reprise' });
    expect(tpl!.days.map((d) => d.workout.title).sort()).toEqual(camilleWeek.map((w) => w.title).sort());

    // Appliquée à Noah deux semaines plus tard : brouillons aux mêmes jours, invisibles pour lui.
    const target = addDays(monday, 14);
    const a = await applyWeekTemplate({ ...meta(USERS.marine), templateId: t.id }, { athleteId: ATHLETES.noah, monday: target });
    const created = (a.body as { created: { workoutId: string; localDate: string }[] }).created;
    expect(created.map((c) => c.localDate).sort()).toEqual(tpl!.days.map((d) => addDays(target, d.offset)).sort());
    const noahWeek = await coachWeek(USERS.marine, WORKSPACE_A, ATHLETES.noah, target, addDays(target, 6));
    expect(noahWeek.filter((w) => created.some((c) => c.workoutId === w.id)).every((w) => w.status === 'draft')).toBe(true);
    expect(await athleteSchedule(USERS.noah, WORKSPACE_A, ATHLETES.noah, target, addDays(target, 6))).toHaveLength(0);

    // Refus : jour autre qu’un lundi, semaine vide, autre espace, élève, élève non suivi.
    expect(await codeOf(weekFromAthlete(meta(USERS.marine), { athleteId: ATHLETES.camille, monday: addDays(monday, 1), title: 'x' }))).toBe('INVALID_FIELDS');
    expect(await codeOf(weekFromAthlete(meta(USERS.marine), { athleteId: ATHLETES.camille, monday: addDays(monday, 70), title: 'x' }))).toBe('INVALID_FIELDS');
    expect(await codeOf(applyWeekTemplate({ ...meta(USERS.hugo), templateId: t.id }, { athleteId: ATHLETES.noah, monday: target }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(applyWeekTemplate({ ...meta(USERS.camille), templateId: t.id }, { athleteId: ATHLETES.camille, monday: target }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(applyWeekTemplate({ ...meta(USERS.marine), templateId: t.id }, { athleteId: ATHLETES.lea, monday: target }))).toBe('RESOURCE_NOT_VISIBLE');

    // Renommée, puis archivée : plus applicable ; révision périmée refusée.
    await updateWeekTemplate({ ...meta(USERS.marine), templateId: t.id }, { expectedRevision: 1, title: 'Reprise douce' });
    expect(await codeOf(updateWeekTemplate({ ...meta(USERS.marine), templateId: t.id }, { expectedRevision: 1, archive: true }))).toBe('CONFLICT_OR_QUOTA');
    await updateWeekTemplate({ ...meta(USERS.marine), templateId: t.id }, { expectedRevision: 2, archive: true });
    expect(await listWeekTemplates(USERS.marine, WORKSPACE_A)).toHaveLength(0);
    expect((await listWeekTemplates(USERS.marine, WORKSPACE_A, true))[0]).toMatchObject({ title: 'Reprise douce', archived: true });
    expect(await codeOf(applyWeekTemplate({ ...meta(USERS.marine), templateId: t.id }, { athleteId: ATHLETES.noah, monday: target }))).toBe('INVALID_FIELDS');
    // Les séances de bibliothèque ne sont pas mêlées aux semaines types.
    expect((await listLibrary(USERS.marine, WORKSPACE_A)).some((x) => x.id === t.id)).toBe(false);
  });
});
