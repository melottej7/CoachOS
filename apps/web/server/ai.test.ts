import { randomUUID } from 'node:crypto';
import { addDays, NO_TWEAKS, todayIn, weekStart } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createGoal } from './commands/portfolio';
import { decideGoal } from './commands/goal-decisions';
import { saveAthleteProfile } from './commands/athlete-profile';
import Anthropic from '@anthropic-ai/sdk';
import { proposeProgramTweaks, setAnthropicClient } from './commands/ai';
import { buildProgram, createProgram, nextMonday, programContext } from './commands/programs';

// D-071 : « Ajuster avec l’IA » (simulée) : proposition tracée, nom retiré, réglages appliqués par le moteur.

const meta = (actorId: string, extra: object = {}) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, athleteId: ATHLETES.noah, ...extra }) as never;
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const today = todayIn(TIME_ZONE);
const event = addDays(weekStart(today), 7 * 12 + 6);
let goal = '';

beforeAll(async () => {
  setDb(await openDatabase());
  await saveAthleteProfile(meta(USERS.noah), { sport: 'running', level: 'intermediate', experience: '1to3', weeklySessions: '2to3', practiceStatus: 'regular', longestRecent: '45to60', availableDays: [2, 4, 6, 7] });
  const r = await createGoal(meta(USERS.marine), { title: 'Semi de printemps', sport: 'running', targetDate: event });
  goal = (r.body as { item: { id: string } }).item.id;
  await decideGoal(meta(USERS.marine, { goalId: goal }), { statusAtDecision: 'ambitious', params: { distanceKm: 21.1, eventDate: event, targetSeconds: 7200, weeklySessions: '4to5', weeklyHours: '4to6' } });
});

describe('ajuster avec l’IA (D-071)', () => {
  it('proposition : réglages validés, demande tracée sans le nom de l’élève ; élève et autre coach refusés', async () => {
    const r = await proposeProgramTweaks(meta(USERS.marine, { goalId: goal }), { text: 'Moins de fractionné pour Noah, sortie longue le samedi', days: [2, 4, 6, 7] });
    const body = r.body as { suggestionId: string; source: string; proposal: { status: string; tweaks: { maxQualityPerWeek: number; longDay: number } } };
    expect(body.source).toBe('simulation');
    expect(body.proposal).toMatchObject({ status: 'ready', tweaks: { maxQualityPerWeek: 1, longDay: 6 } });
    const row = (await readAs(USERS.marine, (tx) => tx.query<{ module: string; state: string; output: { request: string } }>(
      'select module, state, output from public.ai_suggestions where id = $1', [body.suggestionId]))).rows[0]!;
    expect(row).toMatchObject({ module: 'adaptation', state: 'ready' });
    expect(row.output.request).not.toMatch(/Noah/);
    expect(await codeOf(proposeProgramTweaks(meta(USERS.noah, { goalId: goal }), { text: 'Moins de fractionné', days: [2, 4, 6, 7] }))).not.toBe('OK');
    expect(await codeOf(proposeProgramTweaks(meta(USERS.marine, { goalId: goal }), { text: 'x', days: [2, 4, 6, 7] }))).toBe('INVALID_FIELDS');
    // Abstention : rien de reconnu, réglages inchangés.
    const a = await proposeProgramTweaks(meta(USERS.marine, { goalId: goal }), { text: 'Fais au mieux', days: [2, 4, 6, 7] });
    expect((a.body as { proposal: { status: string } }).proposal.status).toBe('abstain');

    // Création avec ces réglages : programme conforme à l’aperçu, réglages gardés, proposition « acceptée ».
    const ctx = (await programContext(USERS.marine, WORKSPACE_A, ATHLETES.noah, goal))!;
    const tweaks = { ...NO_TWEAKS, maxQualityPerWeek: 1, longDay: 6 };
    const preview = buildProgram(ctx, nextMonday(today), [2, 4, 6, 7], tweaks)!;
    expect(preview.weeks.every((w) => w.sessions.filter((s) => s.kind === 'quality').length <= 1)).toBe(true);
    const c = await createProgram(meta(USERS.marine, { goalId: goal }), { startMonday: nextMonday(today), days: [2, 4, 6, 7], acceptRisks: true, tweaks, suggestionId: body.suggestionId });
    const planId = (c.body as { planId: string }).planId;
    const plan = (await readAs(USERS.marine, (tx) => tx.query<{ generator: { tweaks: object } }>('select generator from public.plans where id = $1', [planId]))).rows[0]!;
    expect(plan.generator.tweaks).toEqual(tweaks);
    const state = (await readAs(USERS.marine, (tx) => tx.query<{ state: string }>('select state from public.ai_suggestions where id = $1', [body.suggestionId]))).rows[0]!.state;
    expect(state).toBe('accepted');
  });

  it('Claude (client simulé, aucun appel) : réponse validée ; refus, réponse invalide ou hors bornes et clé refusée gérés', async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-sans-appel';
    let sent: { model?: string; messages?: { content: string }[]; output_config?: unknown; fallbacks?: unknown } = {};
    const reply = (r: unknown) => setAnthropicClient({ beta: { messages: { create: async (body: typeof sent) => { sent = body; if (r instanceof Error) throw r; return r; } } } } as unknown as Anthropic);
    const ok = { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ status: 'ready', tweaks: { maxQualityPerWeek: 1, avoidQuality: ['vma'], volumePct: null, longProgressive: true, longDay: 6 }, days: null, explanation: 'Moins d’intensité.', uncertainty: '' }) }] };
    try {
      reply(ok);
      const r = await proposeProgramTweaks(meta(USERS.marine, { goalId: goal }), { text: 'Noah récupère mal : pas de VMA', days: [2, 4, 6, 7] });
      expect(r.body).toMatchObject({ source: 'claude', proposal: { status: 'ready', tweaks: { avoidQuality: ['vma'], longDay: 6 } } });
      expect(sent.model).toBe('claude-opus-5-5');
      expect(sent.fallbacks).toBe('default');
      expect(sent.messages![0]!.content).not.toMatch(/Noah/); // nom retiré avant l’envoi
      // Refus : abstention, rien n’est appliqué.
      reply({ model: 'claude-opus-5-5', stop_reason: 'refusal', content: [] });
      expect(((await proposeProgramTweaks(meta(USERS.marine, { goalId: goal }), { text: 'Moins de fractionné', days: [2, 4, 6, 7] })).body as { proposal: { status: string } }).proposal.status).toBe('abstain');
      // Réponse hors bornes (volume 200 %) ou illisible : refusée, voie manuelle rappelée.
      reply({ ...ok, content: [{ type: 'text', text: ok.content[0]!.text.replace('"volumePct":null', '"volumePct":200') }] });
      expect(await codeOf(proposeProgramTweaks(meta(USERS.marine, { goalId: goal }), { text: 'Plus de volume', days: [2, 4, 6, 7] }))).toBe('TEMPORARILY_UNAVAILABLE');
      reply({ ...ok, content: [{ type: 'text', text: '{"status":' }] });
      expect(await codeOf(proposeProgramTweaks(meta(USERS.marine, { goalId: goal }), { text: 'Plus de volume', days: [2, 4, 6, 7] }))).toBe('TEMPORARILY_UNAVAILABLE');
      reply(new Anthropic.AuthenticationError(401, undefined, 'clé refusée', new Headers()));
      expect(await codeOf(proposeProgramTweaks(meta(USERS.marine, { goalId: goal }), { text: 'Plus de volume', days: [2, 4, 6, 7] }))).toBe('TEMPORARILY_UNAVAILABLE');
    } finally {
      setAnthropicClient(null);
      if (prev === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});

