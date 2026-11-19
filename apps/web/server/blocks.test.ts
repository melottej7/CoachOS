import { randomUUID } from 'node:crypto';
import { parseNotation } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { archiveBlockTemplate, createBlockTemplate } from './commands/library';
import { listBlockTemplates } from './repo/library';

// D-074 : blocs réutilisables : créés par le coach, visibles de lui seul, retirés sans toucher aux séances.

const meta = (actorId: string, extra: object = {}) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, ...extra }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const warmup = parseNotation(`15' Z1 + 4×(20" Z6 + R40")`, 'running').blocks;

beforeAll(async () => { setDb(await openDatabase()); });

describe('blocs réutilisables (D-074)', () => {
  it('création, sport ou tous sports, coach seulement, liste à soi, retrait', async () => {
    const a = await createBlockTemplate(meta(USERS.marine), { title: 'Échauffement piste', sport: 'running', blocks: warmup });
    await createBlockTemplate(meta(USERS.marine), { title: 'Retour au calme', sport: null, blocks: parseNotation("10' Z1", 'running').blocks });
    expect(await codeOf(createBlockTemplate(meta(USERS.marine), { title: 'Vide', sport: null, blocks: [] }))).toBe('INVALID_FIELDS');
    expect(await codeOf(createBlockTemplate(meta(USERS.marine), { title: '', sport: null, blocks: warmup }))).toBe('INVALID_FIELDS');
    expect(await codeOf(createBlockTemplate(meta(USERS.camille), { title: 'X', sport: null, blocks: warmup }))).not.toBe('OK');
    const list = await listBlockTemplates(USERS.marine, WORKSPACE_A);
    expect(list.map((b) => [b.title, b.sport, b.blocks.length])).toEqual([['Échauffement piste', 'running', warmup.length], ['Retour au calme', null, 1]]);
    expect(await listBlockTemplates(USERS.camille, WORKSPACE_A)).toEqual([]);
    const id = (a.body as { id: string }).id;
    expect(await codeOf(archiveBlockTemplate(meta(USERS.camille, { templateId: id })))).not.toBe('OK');
    await archiveBlockTemplate(meta(USERS.marine, { templateId: id }));
    expect((await listBlockTemplates(USERS.marine, WORKSPACE_A)).map((b) => b.title)).toEqual(['Retour au calme']);
    expect(await codeOf(archiveBlockTemplate(meta(USERS.marine, { templateId: id })))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
