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
