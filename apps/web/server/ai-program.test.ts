import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { addDays, todayIn, weekStart } from '@coachos/domain';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { commandAs, openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A, WORKSPACE_B } from './db/fixtures';
import { AppError } from './errors';
import { setAnthropicClient } from './ai/client';
import { proposeProgramDraft, saveAiProgram, type ProgramProposalResponse } from './commands/ai-program';

// IA-3 (D-191) : programme rédigé par l’agent pour un élève ou un groupe, relu, enregistré en brouillon.

const meta = (actorId: string, wid = WORKSPACE_A, key = randomUUID()) => ({ actorId, idempotencyKey: key, requestId: randomUUID(), workspaceId: wid });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const monday = addDays(weekStart(todayIn(TIME_ZONE)), 7);
const athlete = (id: string) => ({ kind: 'athlete' as const, id });
let team = '';
let teamB = '';

const env = { ...process.env };
afterEach(() => {
  setAnthropicClient(null);
  for (const k of ['ANTHROPIC_API_KEY', 'COACHOS_AI']) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
});
const count = async (sql: string, args: unknown[]) => Number((await commandAs(USERS.marine, (tx) => tx.query<{ n: string }>(sql, args))).rows[0]!.n);
const publishedOf = (aid: string) => count('select count(*) as n from public.workouts where workspace_id = $1 and athlete_id = $2 and published_revision is not null', [WORKSPACE_A, aid]);
const workoutsOf = (aid: string) => count('select count(*) as n from public.workouts where workspace_id = $1 and athlete_id = $2', [WORKSPACE_A, aid]);

beforeAll(async () => {
  setDb(await openDatabase());
  await commandAs(USERS.marine, async (tx) => {
    team = (await tx.query<{ id: string }>(`insert into public.teams(workspace_id, name) values ($1, 'Débutants') returning id`, [WORKSPACE_A])).rows[0]!.id;
    await tx.query('insert into public.team_athletes(workspace_id, team_id, athlete_id) values ($1, $2, $3), ($1, $2, $4)', [WORKSPACE_A, team, ATHLETES.noah, ATHLETES.camille]);
    teamB = (await tx.query<{ id: string }>(`insert into public.teams(workspace_id, name) values ($1, 'Trail') returning id`, [WORKSPACE_B])).rows[0]!.id;
  });
});

describe('programme par l’agent (IA-3)', () => {
  it('élève : brouillon de 4 semaines lu, relu, puis enregistré en brouillon (rien publié), sans doublon à la reprise', async () => {
    const r = (await proposeProgramDraft(meta(USERS.marine), { text: 'Prépare 4 semaines de force pour Camille, 3 séances par semaine, salle Basic-Fit', weeks: 4, startMonday: monday, target: athlete(ATHLETES.camille) })).body as ProgramProposalResponse;
    expect(r).toMatchObject({ source: 'simulation', status: 'ready' });
    expect(r.program.weeks).toHaveLength(4);
    expect(r.program.weeks.every((w) => w.sessions.length === 3 && w.sessions.every((s) => s.ok && s.sport === 'strength'))).toBe(true);
    expect(r.read.map((x) => x.name)).toEqual(['listerExercices', 'lireChargesRecentes']);
    expect(JSON.stringify(r)).not.toMatch(/Camille|Laurent/);
    const row = (await commandAs(USERS.marine, (tx) => tx.query<{ module: string; athlete_id: string; state: string }>('select module, athlete_id, state from public.ai_suggestions where id = $1', [r.suggestionId]))).rows[0]!;
    expect(row).toEqual({ module: 'program', athlete_id: ATHLETES.camille, state: 'ready' });

    const before = await workoutsOf(ATHLETES.camille);
    const publishedBefore = await publishedOf(ATHLETES.camille);
    const sessions = r.program.weeks.flatMap((w) => w.sessions.map((s) => ({ date: s.date, sport: s.sport, title: s.title, notation: s.notation })));
    sessions[0]!.notation = sessions[0]!.notation.replace('3×10', '3×12'); // le coach corrige avant d’enregistrer
    const key = randomUUID();
    const saved = await saveAiProgram(meta(USERS.marine, WORKSPACE_A, key), { suggestionId: r.suggestionId, sessions });
    expect(saved.body).toEqual({ created: 12, kind: 'athlete' });
    expect(await workoutsOf(ATHLETES.camille)).toBe(before + 12);
    expect(await publishedOf(ATHLETES.camille)).toBe(publishedBefore); // rien n’est publié
    await saveAiProgram(meta(USERS.marine, WORKSPACE_A, key), { suggestionId: r.suggestionId, sessions });
    expect(await workoutsOf(ATHLETES.camille)).toBe(before + 12); // reprise : pas de doublon
    expect((await commandAs(USERS.marine, (tx) => tx.query<{ state: string }>('select state from public.ai_suggestions where id = $1', [r.suggestionId]))).rows[0]!.state).toBe('accepted');
  });

  it('élève sans historique : « charge à choisir » ; enregistrement refusé si une séance ne se lit pas ou sort des dates', async () => {
    const r = (await proposeProgramDraft(meta(USERS.marine), { text: 'Force, 2 séances par semaine', weeks: 2, startMonday: monday, target: athlete(ATHLETES.noah) })).body as ProgramProposalResponse;
    expect(r.program.weeks[0]!.sessions[0]!.notation).toMatch(/« charge à choisir »/);
    const before = await workoutsOf(ATHLETES.noah);
    const bad = [{ date: monday, sport: 'strength', title: 'A', notation: 'fais au mieux' }, { date: addDays(monday, 30), sport: 'strength', title: 'B', notation: '3×10 squats' }];
    expect(await codeOf(saveAiProgram(meta(USERS.marine), { suggestionId: r.suggestionId, sessions: bad }))).toBe('INVALID_FIELDS');
    expect(await workoutsOf(ATHLETES.noah)).toBe(before);
  });

  it('groupe : un brouillon par membre affecté ; groupe ou élève d’un autre espace refusés ; demande impossible : abstention', async () => {
    const r = (await proposeProgramDraft(meta(USERS.marine), { text: 'Force pour le groupe Débutants, 2 séances par semaine', weeks: 1, startMonday: monday, target: { kind: 'team', id: team } })).body as ProgramProposalResponse;
    expect(r.status).toBe('ready');
    const groupsBefore = await count('select count(*) as n from public.group_sessions where workspace_id = $1', [WORKSPACE_A]);
    const sessions = r.program.weeks.flatMap((w) => w.sessions.map((s) => ({ date: s.date, sport: s.sport, title: s.title, notation: s.notation })));
    expect((await saveAiProgram(meta(USERS.marine), { suggestionId: r.suggestionId, sessions })).body).toEqual({ created: 2, kind: 'team' });
    expect(await count('select count(*) as n from public.group_sessions where workspace_id = $1', [WORKSPACE_A])).toBe(groupsBefore + 2);
    expect(await codeOf(proposeProgramDraft(meta(USERS.marine), { text: 'Force', weeks: 1, startMonday: monday, target: { kind: 'team', id: teamB } }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(proposeProgramDraft(meta(USERS.marine), { text: 'Force', weeks: 1, startMonday: monday, target: athlete(ATHLETES.lea) }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(proposeProgramDraft(meta(USERS.hugo, WORKSPACE_B), { text: 'Force', weeks: 1, startMonday: monday, target: athlete(ATHLETES.camille) }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(proposeProgramDraft(meta(USERS.camille), { text: 'Force', weeks: 1, startMonday: monday, target: athlete(ATHLETES.camille) }))).toBe('RESOURCE_NOT_VISIBLE');
    // La proposition d’un coach ne s’enregistre pas par un autre.
    expect(await codeOf(saveAiProgram(meta(USERS.hugo, WORKSPACE_B), { suggestionId: r.suggestionId, sessions }))).toBe('RESOURCE_NOT_VISIBLE');
    const no = (await proposeProgramDraft(meta(USERS.marine), { text: '10 séances par semaine', weeks: 2, startMonday: monday, target: athlete(ATHLETES.noah) })).body as ProgramProposalResponse;
    expect(no).toMatchObject({ status: 'abstain' });
    expect(no.note).toMatch(/entre 1 et 6/);
  });

  it('Claude (faux runner) : en flux, effort medium, tours plafonnés ; plafond atteint : rien ; modèle indisponible : voie manuelle', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-sans-appel';
    delete process.env.COACHOS_AI;
    const seen: Record<string, unknown>[] = [];
    const runner = (turns: { stop: string; text?: string }[], fail = false) => setAnthropicClient({ beta: { messages: { toolRunner: (params: Record<string, unknown>) => {
      seen.push(params);
      return (async function* run() {
        if (fail) throw new Anthropic.APIConnectionError({ message: 'réseau coupé' });
        for (const t of turns) yield { model: 'claude-opus-5-5', stop_reason: t.stop, usage: { input_tokens: 1000, output_tokens: 500 }, content: t.text ? [{ type: 'text', text: t.text }] : [] };
      })();
    } } } } as unknown as Anthropic);
    runner(Array.from({ length: 8 }, () => ({ stop: 'tool_use' })));
    const capped = (await proposeProgramDraft(meta(USERS.marine), { text: 'Force', weeks: 1, startMonday: monday, target: athlete(ATHLETES.noah) })).body as ProgramProposalResponse;
    expect(capped).toMatchObject({ status: 'abstain', program: { weeks: [] } });
    expect(capped.note).toMatch(/n’a pas pu traiter/);
    expect(seen[0]).toMatchObject({ stream: true, max_iterations: 8, output_config: { effort: 'medium' }, max_tokens: 16000 });
    const draft = { status: 'ready', intention: 'Force.', remarque: '', semaines: [{ numero: 1, intention: 'Départ.', seances: [{ jour: 2, sport: 'strength', titre: 'Force A', lignes: ["échauffement 10' RPE3", '3×10 presse à cuisses « charge à choisir »'] }] }] };
    runner([{ stop: 'end_turn', text: JSON.stringify(draft) }]);
    const ok = (await proposeProgramDraft(meta(USERS.marine), { text: 'Force', weeks: 1, startMonday: monday, target: athlete(ATHLETES.noah) })).body as ProgramProposalResponse;
    expect(ok).toMatchObject({ source: 'claude', status: 'ready', program: { ok: true } });
    const msg = (seen.at(-1)!.messages as { content: string }[])[0]!.content;
    expect(msg).not.toMatch(/Noah|Dubois|[0-9a-f]{8}-[0-9a-f]{4}-/);
    runner([], true);
    expect(await codeOf(proposeProgramDraft(meta(USERS.marine), { text: 'Force', weeks: 1, startMonday: monday, target: athlete(ATHLETES.noah) }))).toBe('TEMPORARILY_UNAVAILABLE');
  });
});
