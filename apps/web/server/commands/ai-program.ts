import { createHash } from 'node:crypto';
import {
  addDays, AI_PROGRAM_JSON_SCHEMA, AI_PROGRAM_PROMPT_VERSION, AI_PROGRAM_SYSTEM_PROMPT, checkProgramDraft, isLocalDate, parseNotation, parseWith,
  programDraftSchema, programRequestSchema, programUserMessage, redactNames, simulateProgram, SPORTS,
  type CheckedProgram, type ProgramDraft, type ProgramFacts, type ProgramRequest, type Sport,
} from '@coachos/domain';
import { z } from 'zod';
import { AI_COULD_NOT, evidenceHash, recordSuggestion, runWithTools } from '../ai/call';
import { AthleteRefs, openScope, type ToolCallTrace } from '../ai/tools';
import { commandAs, readAs } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { readCoachMethod } from './coach-method';
import { createGroupSession } from './group-sessions';
import { requireAssigned } from './portfolio';
import { createWorkout } from './workouts';

/**
 * IA-3 (D-191) · « Préparer un programme avec l’IA » pour un élève ou un groupe. L’agent lit nos données avec les droits
 * du coach et rend un brouillon de programme ; le serveur relit chaque séance et contrôle bornes et progression.
 * « Enregistrer en brouillon » crée des séances non publiées (élève) ou des séances de groupe en brouillon (un
 * brouillon par membre). La publication reste la commande habituelle.
 */

const MANUAL = 'Tu peux préparer le programme à la main (calendrier, bibliothèque, générateur)';
type Meta = { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string };
type Target = { kind: 'athlete' | 'team'; id: string; name: string; members: { id: string; name: string; tz: string }[]; sport: Sport | null; timeZone: string };

/** Élève affecté, ou groupe de l’espace avec ses membres affectés au coach (dossiers actifs). Refus sinon. */
async function resolveTarget(actorId: string, wid: string, target: ProgramRequest['target']): Promise<Target> {
  if (target.kind === 'athlete') {
    await commandAs(actorId, (tx) => requireAssigned(tx, wid, target.id));
    return readAs(actorId, async (tx) => {
      const a = (await tx.query<{ display_name: string; time_zone: string; sport: Sport | null }>(
        `select a.display_name, a.time_zone, p.sport_code as sport from public.athletes a
           left join public.athlete_profiles p on p.workspace_id = a.workspace_id and p.athlete_id = a.id
          where a.workspace_id = $1 and a.id = $2`, [wid, target.id])).rows[0];
      if (!a) throw notVisible();
      return { kind: 'athlete', id: target.id, name: a.display_name, members: [{ id: target.id, name: a.display_name, tz: a.time_zone }], sport: a.sport, timeZone: a.time_zone };
    });
  }
  return commandAs(actorId, async (tx) => {
    const t = (await tx.query<{ name: string; ok: boolean }>(
      `select name, private.current_coach($1) as ok from public.teams where workspace_id = $1 and id = $2 and archived_at is null`, [wid, target.id])).rows[0];
    if (!t?.ok) throw notVisible();
    const m = await tx.query<{ id: string; display_name: string; time_zone: string; sport: Sport | null }>(
      `select a.id, a.display_name, a.time_zone, p.sport_code as sport from public.team_athletes ta
         join public.athletes a on a.workspace_id = ta.workspace_id and a.id = ta.athlete_id and a.state <> 'archived'
         left join public.athlete_profiles p on p.workspace_id = a.workspace_id and p.athlete_id = a.id
        where ta.workspace_id = $1 and ta.team_id = $2 and private.assigned(ta.workspace_id, ta.athlete_id)
        order by a.created_at, a.id`, [wid, target.id]);
    if (!m.rows.length) throw invalid([{ path: 'target', rule: 'Aucun élève de ce groupe ne t’est affecté' }]);
    const sports = m.rows.map((x) => x.sport).filter((x): x is Sport => Boolean(x));
    const sport = sports.sort((a, b) => sports.filter((x) => x === b).length - sports.filter((x) => x === a).length)[0] ?? null;
    return { kind: 'team', id: target.id, name: t.name, members: m.rows.map((x) => ({ id: x.id, name: x.display_name, tz: x.time_zone })), sport, timeZone: m.rows[0]!.time_zone };
  });
}

export interface ProgramProposalResponse {
  suggestionId: string; source: 'simulation' | 'claude'; status: 'ready' | 'abstain'; intention: string; note: string;
  program: { weeks: { number: number; monday: string; intention: string; minutes: number; sessions: { date: string; day: number; sport: Sport; title: string; notation: string; lines: { text: string; error: string | null }[]; minutes: number; ok: boolean }[] }[]; risks: { level: string; text: string }[]; ok: boolean };
  read: { name: string; ok: boolean }[];
}

const publicProgram = (c: CheckedProgram): ProgramProposalResponse['program'] => ({
  ok: c.ok, risks: c.risks,
  weeks: c.weeks.map((w) => ({ ...w, sessions: w.sessions.map(({ blocks: _b, ...s }) => s) })),
});

/** proposeProgramDraft · C : brouillon de programme (rien n’est créé ni publié). */
export async function proposeProgramDraft(meta: Meta, body: unknown): Promise<StoredResponse> {
  const p = parseWith(programRequestSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as ProgramRequest;
  const wid = meta.workspaceId;
  const refs = new AthleteRefs();
  const scope = await openScope(meta.actorId, wid, refs);
  const target = await resolveTarget(meta.actorId, wid, v.target);
  const facts: ProgramFacts = {
    cible: { type: target.kind === 'athlete' ? 'eleve' : 'groupe', refs: target.members.map((m) => refs.ref(m.id)), groupe: target.kind === 'team' ? target.name : null },
    sport: target.sport, semaines: v.weeks, premierLundi: v.startMonday,
  };
  const text = redactNames(v.text, target.members.map((m) => m.name));
  const method = (await readCoachMethod(meta.actorId, wid)).method;

  const answer = await runWithTools<ProgramDraft>({
    actorId: meta.actorId, workspaceId: wid, scope, manual: MANUAL, effort: 'medium', maxTokens: 16_000, maxIterations: 8, long: true,
    system: AI_PROGRAM_SYSTEM_PROMPT, method, user: programUserMessage(facts, text),
    jsonSchema: AI_PROGRAM_JSON_SCHEMA as unknown as Record<string, unknown>, schema: programDraftSchema,
    simulate: async (call) => {
      const ex = await call('listerExercices', { recherche: null, muscle: null }) as { bibliotheque: { nom: string; muscle: string }[]; machines: { nom: string; muscle: string; niveau: number }[] };
      const loads: Record<string, number> = {};
      const charges = await call('lireChargesRecentes', { eleve: facts.cible.refs[0], exercice: null }) as { exercices?: { exercice: string; seances: { series: { kg: number | null }[] }[] }[] };
      for (const e of charges.exercices ?? []) { const kg = e.seances[0]?.series.at(-1)?.kg; if (kg) loads[e.exercice.toLowerCase()] = kg; }
      return simulateProgram({
        text, weeks: v.weeks, sport: target.sport,
        exercises: [...ex.machines.filter((m) => m.niveau === 1).map((m) => ({ nom: m.nom, muscle: m.muscle, machine: true })), ...ex.bibliotheque.map((b) => ({ nom: b.nom, muscle: b.muscle, machine: false }))],
        loads,
      });
    },
  });
  const draft: ProgramDraft = answer.output ?? { status: 'abstain', intention: '', semaines: [], remarque: `${AI_COULD_NOT} ${MANUAL}.` };
  const checked = checkProgramDraft(draft, v.startMonday, v.weeks);
  const hash = evidenceHash({ facts, text, v: AI_PROGRAM_PROMPT_VERSION });
  const read = answer.toolCalls.map((t: ToolCallTrace) => ({ name: t.name, ok: t.ok }));

  return commandAs(meta.actorId, async (tx) => idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'ai.program', key: meta.idempotencyKey, body: v }, async () => {
    const id = await recordSuggestion(tx, {
      workspaceId: wid, athleteId: target.kind === 'athlete' ? target.id : null, module: 'program', model: answer.model, promptVersion: AI_PROGRAM_PROMPT_VERSION, hash,
      output: { request: text, target: v.target, weeks: v.weeks, startMonday: v.startMonday, facts, source: answer.source, draft, risks: checked.risks, usage: answer.usage, declined: answer.declined, toolCalls: answer.toolCalls },
    });
    await audit(tx, wid, meta.actorId, 'ai.program', id, meta.requestId);
    const resp: ProgramProposalResponse = {
      suggestionId: id, source: answer.source, status: draft.status === 'ready' && checked.weeks.length ? 'ready' : 'abstain',
      intention: draft.intention, note: draft.remarque, program: publicProgram(checked), read,
    };
    return { status: 200, body: resp };
  }));
}

const saveSchema = z.object({
  suggestionId: z.string().uuid(),
  sessions: z.array(z.object({
    date: z.string().refine(isLocalDate, { message: 'Date invalide' }),
    sport: z.enum(SPORTS),
    title: z.string().trim().min(1, { message: 'Saisir un titre' }).max(120),
    notation: z.string().trim().min(1, { message: 'Séance vide' }).max(700, { message: '700 caractères au plus' }),
  }).strict()).min(1, { message: 'Aucune séance à enregistrer' }).max(72), // 12 semaines × 6 séances ; reste sous la taille de requête (64 Kio)
}).strict();

/** Clé d’idempotence dérivée (une par séance) : reprendre l’enregistrement ne crée pas de doublon. */
const derivedKey = (key: string, i: number) => {
  const h = createHash('sha256').update(`${key}:${i}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

/**
 * saveAiProgram · C : enregistre en brouillon le programme relu par le coach. Chaque séance est relue (notation stricte,
 * dates dans le programme) ; une seule erreur et rien n’est créé. Rien n’est publié.
 */
export async function saveAiProgram(meta: Meta, body: unknown): Promise<StoredResponse> {
  const p = parseWith(saveSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as z.output<typeof saveSchema>;
  const wid = meta.workspaceId;
  const sug = await commandAs(meta.actorId, async (tx) => (await tx.query<{ state: string; output: { target: ProgramRequest['target']; weeks: number; startMonday: string } }>(
    `select state, output from public.ai_suggestions where workspace_id = $1 and id = $2 and module = 'program' and coach_id = auth.uid()`, [wid, v.suggestionId])).rows[0]);
  if (!sug) throw notVisible();
  const target = await resolveTarget(meta.actorId, wid, sug.output.target);
  const end = addDays(sug.output.startMonday, sug.output.weeks * 7);
  const fields: { path: string; rule: string }[] = [];
  const parsed = v.sessions.map((s, i) => {
    if (s.date < sug.output.startMonday || s.date >= end) fields.push({ path: `sessions.${i}.date`, rule: 'Date hors du programme' });
    const r = parseNotation(s.notation, s.sport);
    if (r.errors.length || !r.blocks.length) fields.push({ path: `sessions.${i}.notation`, rule: r.errors[0]?.message ?? 'Séance vide' });
    return { ...s, blocks: r.blocks };
  });
  if (fields.length) throw invalid(fields);

  let created = 0;
  for (const [i, s] of parsed.entries()) {
    const workout = { sport: s.sport, title: s.title, durationSeconds: null, instructions: null, intervals: s.blocks };
    const m = { actorId: meta.actorId, workspaceId: wid, idempotencyKey: derivedKey(meta.idempotencyKey, i), requestId: meta.requestId };
    if (target.kind === 'athlete') await createWorkout({ ...m, athleteId: target.id }, { data: { ...workout, localDate: s.date, timeZone: target.timeZone } });
    else await createGroupSession(m, { teamId: target.id, localDate: s.date, workout, athleteIds: target.members.map((x) => x.id) });
    created++;
  }
  await commandAs(meta.actorId, async (tx) => {
    await tx.query(`update public.ai_suggestions set state = 'accepted' where workspace_id = $1 and id = $2 and coach_id = auth.uid()`, [wid, v.suggestionId]);
    await audit(tx, wid, meta.actorId, 'ai.program.save', v.suggestionId, meta.requestId);
  });
  return { status: 201, body: { created, kind: target.kind } };
}
