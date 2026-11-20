import { randomUUID } from 'node:crypto';
import { IMPORT_EXAMPLE, previewImport } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { importLibrary } from './commands/library';
import { listLibrary } from './repo/library';

// D-079 : import de la base du coach. Aperçu dans le navigateur, puis ajout sans écraser ; coach seulement.

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}

beforeAll(async () => { setDb(await openDatabase()); });

describe('import de la base du coach (D-079)', () => {
  it('séances de l’aperçu ajoutées une fois, provenance « import », élève refusé, corps invalide refusé', async () => {
    const before = await listLibrary(USERS.marine, WORKSPACE_A);
    const items = previewImport(IMPORT_EXAMPLE, { defaultSport: 'running' }).rows.map((r) => ({ category: r.category, workout: r.workout! }));
    const r = await importLibrary(meta(USERS.marine), { items });
    expect(r.body).toEqual({ added: 4, skipped: 0 });
    // Rejouer : rien n’est doublé ni écrasé.
    expect((await importLibrary(meta(USERS.marine), { items })).body).toEqual({ added: 0, skipped: 4 });
    const after = await listLibrary(USERS.marine, WORKSPACE_A);
    expect(after.length).toBe(before.length + 4);
    const vma = after.find((i) => i.workout.title === 'VMA courte')!;
    expect(vma.category).toBe('intervals');
    expect(vma.meta?.source).toBe('import');
    expect(vma.workout.intervals.length).toBe(3);
    expect(await codeOf(importLibrary(meta(USERS.camille), { items }))).not.toBe('OK');
    expect(await codeOf(importLibrary(meta(USERS.marine), { items: [] }))).toBe('INVALID_FIELDS');
    expect(await codeOf(importLibrary(meta(USERS.marine), { items: [{ category: 'other', workout: { ...items[0]!.workout, title: '' } }] }))).toBe('INVALID_FIELDS');
  });
});

// D-085 : ancien programme du coach enregistré comme programme type, puis appliqué à un élève en brouillons.
describe('import d’un ancien programme (D-085)', () => {
  it('aperçu → programme type de plusieurs semaines → brouillons aux bons jours ; élève refusé', async () => {
    const { previewProgramImport, programTemplateDays, addDays, weekStart, todayIn } = await import('@coachos/domain');
    const { applyWeekTemplate, importProgram } = await import('./commands/library');
    const { listWeekTemplates } = await import('./repo/library');
    const { ATHLETES } = await import('./db/fixtures');
    const text = "Programme 10 km\nS1\nMar · Footing 30' Z1-2\nDim · Sortie longue 45' Z1-2\nS2\nJeu · Fract : 15' Z1 + 3*(2km 4'40 + 400m Z1) + 10' Z1\nDim · Sortie longue 50'";
    const g = previewProgramImport(text, { defaultSport: 'running' }).programs[0]!;
    const body = { title: g.title, weeks: g.weeks.length, days: programTemplateDays(g) };
    const r = await importProgram(meta(USERS.marine), body);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ sessions: 4, weeks: 2 });
    const tid = (r.body as { id: string }).id;
    const tpl = (await listWeekTemplates(USERS.marine, WORKSPACE_A)).find((t) => t.id === tid)!;
    expect(tpl.title).toBe('Programme 10 km');
    expect(tpl.weeks).toBe(2);
    const monday = addDays(weekStart(todayIn('Europe/Brussels')), 28);
    const ap = await applyWeekTemplate({ ...(meta(USERS.marine) as object), templateId: tid } as never, { athleteId: ATHLETES.noah, monday });
    const created = (ap.body as { created: { localDate: string }[] }).created.map((c) => c.localDate);
    expect(created).toEqual([addDays(monday, 1), addDays(monday, 6), addDays(monday, 10), addDays(monday, 13)]);
    expect(await codeOf(importProgram(meta(USERS.camille), body))).not.toBe('OK');
    expect(await codeOf(importProgram(meta(USERS.marine), { ...body, weeks: 1 }))).toBe('INVALID_FIELDS');
    expect(await codeOf(importProgram(meta(USERS.marine), { ...body, days: [] }))).toBe('INVALID_FIELDS');
  });
});
