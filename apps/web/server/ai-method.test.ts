import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { EMPTY_METHOD } from '@coachos/domain';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commandAs, openDatabase, setDb, type Db } from './db/client';
import { USERS, WORKSPACE_A, WORKSPACE_B } from './db/fixtures';
import { AppError } from './errors';
import { setAnthropicClient } from './ai/client';
import { proposeMethod, type MethodProposalResponse } from './commands/ai-method';
import { dictateWorkout } from './commands/ai-dictation';
import { readCoachMethod, saveCoachMethod } from './commands/coach-method';
import { createTemplate } from './commands/library';

// IA-2 (D-190) : la méthode du coach en six champs, proposée depuis sa bibliothèque, lue par l’IA dans un bloc caché.

const ASSIST = '00000000-0000-4000-8000-0000000000a7';
const meta = (actorId: string, wid = WORKSPACE_A) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: wid });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const strength = (title: string, name: string) => ({ sport: 'strength', title, intervals: [
  { type: 'step', phase: 'warmup', measure: { kind: 'time', seconds: 600 }, intensity: { kind: 'rpe', min: 3, max: null } },
  { type: 'repeat', times: 4, steps: [{ type: 'step', phase: 'work', measure: { kind: 'reps', reps: 10 }, intensity: { kind: 'load', min: 40, max: null }, exercise: { id: null, name } }, { type: 'step', phase: 'recovery', measure: { kind: 'time', seconds: 120 } }] },
] });

const env = { ...process.env };
afterEach(() => {
  setAnthropicClient(null);
  for (const k of ['ANTHROPIC_API_KEY', 'COACHOS_AI']) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
});

let db: Db;
beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  await db.query('insert into auth.users(id, email) values ($1, $2)', [ASSIST, 'assist-ia@demo.coachos.test']);
  await db.query('insert into public.users(id, display_name) values ($1, $2)', [ASSIST, 'Assistante']);
  await db.query(`insert into public.memberships(workspace_id, user_id, role) values ($1, $2, 'coach')`, [WORKSPACE_A, ASSIST]);
});

describe('méthode du coach (IA-2)', () => {
  it('proposition depuis la bibliothèque : abstention sous trois séances, puis constats ; rien n’est enregistré sans le coach', async () => {
    const before = await readCoachMethod(USERS.marine, WORKSPACE_A);
    const a = (await proposeMethod(meta(USERS.marine), {})).body as MethodProposalResponse;
    expect(a).toMatchObject({ source: 'simulation', status: 'abstain' });
    for (const [t, n] of [['Jambes', 'Presse à cuisses'], ['Dos', 'Tirage vertical'], ['Pecs', 'Développé machine']] as const) {
      await createTemplate(meta(USERS.marine), { category: 'other', workout: strength(t, n) });
    }
    const r = (await proposeMethod(meta(USERS.marine), {})).body as MethodProposalResponse;
    expect(r.status).toBe('ready');
    expect(r.notes.echauffement).toMatch(/10 min d’échauffement/);
    expect(r.notes.repos).toMatch(/2 min/);
    expect((await readCoachMethod(USERS.marine, WORKSPACE_A)).version).toBe(before.version); // rien d’enregistré
    const row = (await commandAs(USERS.marine, (tx) => tx.query<{ module: string; athlete_id: string | null }>('select module, athlete_id from public.ai_suggestions where id = $1', [r.suggestionId]))).rows[0]!;
    expect(row).toEqual({ module: 'method', athlete_id: null });
    expect(await codeOf(proposeMethod(meta(USERS.marine), { texte: 'x' }))).toBe('INVALID_FIELDS');
  });

  it('versions : chaque enregistrement crée une version, la précédente reste ; les règles et la philosophie sont gardées', async () => {
    await saveCoachMethod(meta(USERS.marine), { expectedVersion: (await readCoachMethod(USERS.marine, WORKSPACE_A)).version, method: EMPTY_METHOD, reason: 'Départ' });
    const cur = await readCoachMethod(USERS.marine, WORKSPACE_A);
    const notes = { ...EMPTY_METHOD.notes, repos: '2 min sur les gros exercices.', jamais: 'Pas de charge maximale.' };
    await saveCoachMethod(meta(USERS.marine), { expectedVersion: cur.version, method: { ...cur.method, philosophy: 'Régularité.', notes }, reason: 'Méthode en quelques mots' });
    const next = await readCoachMethod(USERS.marine, WORKSPACE_A);
    expect(next.version).toBe(cur.version + 1);
    expect(next.method).toMatchObject({ philosophy: 'Régularité.', notes });
    expect(next.history.map((h) => h.version)).toContain(cur.version);
    expect(await codeOf(saveCoachMethod(meta(USERS.marine), { expectedVersion: cur.version, method: next.method }))).toBe('CONFLICT_OR_QUOTA');
  });

  it('droits : un autre coach du même espace ne lit pas cette méthode ni ces séances ; autre espace refusé', async () => {
    const other = await readCoachMethod(ASSIST, WORKSPACE_A);
    expect(other.version).toBe(0);
    expect(other.method.notes.repos).toBeNull();
    const p = (await proposeMethod(meta(ASSIST), {})).body as MethodProposalResponse;
    expect(p.status).toBe('abstain'); // ses propres séances seulement : aucune
    expect(await codeOf(proposeMethod(meta(USERS.hugo), {}))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(proposeMethod(meta(USERS.camille), {}))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(proposeMethod(meta(USERS.hugo, WORKSPACE_B), {}))).toBe('OK');
  });

  it('méthode acceptée lue par la dictée, après la consigne fixe ; consigne et outils inchangés (cache conservé)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-sans-appel';
    delete process.env.COACHOS_AI;
    const seen: { system: { text: string; cache_control?: unknown }[]; tools: unknown[] }[] = [];
    setAnthropicClient({ beta: { messages: { toolRunner: (params: (typeof seen)[number]) => {
      seen.push(params);
      return (async function* run() { yield { model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, content: [{ type: 'text', text: JSON.stringify({ status: 'ready', lignes: ['3×12 squats'], remarque: '' }) }] }; })();
    } } } } as unknown as Anthropic);
    await dictateWorkout(meta(USERS.marine), { text: '3 fois 12 squats', sport: 'strength' });
    await dictateWorkout(meta(ASSIST), { text: '3 fois 12 squats', sport: 'strength' });
    const [mine, empty] = seen;
    expect(mine!.system).toHaveLength(2);
    expect(mine!.system[1]!.text).toMatch(/^<methode_du_coach>[\s\S]*Mes temps de repos : 2 min sur les gros exercices\./);
    expect(mine!.system[1]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(empty!.system).toHaveLength(1); // méthode vide : rien n’est ajouté
    expect(JSON.stringify(mine!.system[0])).toBe(JSON.stringify(empty!.system[0])); // consigne fixe identique
    expect(JSON.stringify(mine!.tools)).toBe(JSON.stringify(empty!.tools)); // outils identiques
  });
});
