import {
  addDays, createProgramSchema, generateProgram, parseWith, planRegeneration, programInstructions, programPhaseTitle, regenerateProgramSchema,
  regenWeekCount, todayIn, weekStart,
  type Block, type CreateProgramInput, type FeasibilityInput, type LibrarySession, type PlannedSession, type Program, type ProgramSession,
  type ProgramWeek, type RegenerateProgramInput, type Regeneration, type WorkoutInput,
} from '@coachos/domain';
import { commandAs, readAs, type Tx } from '../db/client';
import { conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned } from './portfolio';
import { insertRevision } from './workouts';
import { readAthleteProfile } from './athlete-profile';
import { readAthleteReferences } from './athlete-references';
import { readPerformances } from './performances';
import { readGoalDecisions, type GoalDecision } from './goal-decisions';
import { athleteStats } from '../repo/stats';
import { listLibrary } from '../repo/library';

// D-061 : générateur de programme. Entrées lues en base (jamais reprises du navigateur) ; programme créé en brouillons.

export interface ProgramContext {
  goal: { id: string; title: string; sport: FeasibilityInput['sport']; targetDate: string | null; state: string };
  decision: GoalDecision | null;
  athlete: { name: string; timeZone: string };
  today: string;
  /** Jours proposés par défaut : ceux du bilan, sinon mardi, jeudi, samedi, dimanche. */
  defaultDays: number[];
  /** null si le bilan manque (le générateur en a besoin). */
  feasibility: FeasibilityInput | null;
  currentWeeklyMin: number | null;
  refs: Awaited<ReturnType<typeof readAthleteReferences>>;
  /** Séances de la bibliothèque du coach (D-062), choisies d’abord quand elles conviennent. */
  library: LibrarySession[];
}

/** Tout ce que le générateur doit savoir de l’élève et de l’objectif validé. null si non visible. */
export async function programContext(userId: string, wid: string, aid: string, goalId: string): Promise<ProgramContext | null> {
  const base = await readAs(userId, async (tx) => {
    const a = await tx.query<{ display_name: string; time_zone: string; ok: boolean }>(
      'select display_name, time_zone, private.assigned(workspace_id, id) as ok from public.athletes where workspace_id = $1 and id = $2', [wid, aid],
    );
    if (!a.rows[0]?.ok) return null;
    const g = await tx.query<{ id: string; title: string; sport_code: FeasibilityInput['sport']; target_date: string | null; state: string }>(
      `select id, title, sport_code, to_char(target_date, 'YYYY-MM-DD') as target_date, state from public.goals where workspace_id = $1 and athlete_id = $2 and id = $3`,
      [wid, aid, goalId],
    );
    return g.rows[0] ? { a: a.rows[0], g: g.rows[0] } : null;
  });
  if (!base) return null;
  const today = todayIn(base.a.time_zone);
  const [profile, refs, perfs, decisions, lib] = await Promise.all([
    readAthleteProfile(userId, wid, aid), readAthleteReferences(userId, wid, aid), readPerformances(userId, wid, aid), readGoalDecisions(userId, wid, aid),
    listLibrary(userId, wid),
  ]);
  const library: LibrarySession[] = lib
    .filter((x) => x.workout.intervals?.length)
    .map((x) => ({ id: x.id, title: x.workout.title, category: x.category, sport: x.workout.sport, blocks: x.workout.intervals as Block[], instructions: x.workout.instructions ?? null }));
  const decision = decisions.find((d) => d.goalId === goalId) ?? null;
  const past = await athleteStats(userId, wid, aid, addDays(today, -41), today, today);
  const done = (past?.history ?? []).filter((r) => !r.canceled && (r.state === 'completed' || r.state === 'partial'));
  const doneMin = (r: (typeof done)[number]) => Math.round((r.doneSeconds ?? (r.state === 'completed' ? r.plannedSeconds ?? 0 : 0)) / 60);
  const last4 = done.filter((r) => r.localDate > addDays(today, -28));
  const currentWeeklyMin = last4.length ? Math.round(last4.reduce((n, r) => n + doneMin(r), 0) / 4) : null;
  const params = decision?.params;
  const feasibility: FeasibilityInput | null = profile ? {
    sport: base.g.sport_code,
    distanceKm: params?.distanceKm ?? 10,
    eventDate: params?.eventDate ?? base.g.target_date ?? addDays(today, 84),
    targetSeconds: params?.targetSeconds ?? null,
    level: profile.level, practiceStatus: profile.practiceStatus, longestRecent: profile.longestRecent,
    weeklySessions: params?.weeklySessions ?? profile.weeklySessions, weeklyHours: params?.weeklyHours ?? profile.weeklyHours, today,
    history: {
      experience: profile.experience, breakLength: profile.breakLength, resumedSince: profile.resumedSince,
      recentLongestDoneMin: done.reduce((m, r) => Math.max(m, doneMin(r)), 0) || null,
      regularity: null, achievedKm: Math.max(0, ...perfs.filter((p) => p.sport === base.g.sport_code && p.kind === 'race').map((p) => p.distanceM / 1000)) || null,
      performances: perfs,
    },
  } : null;
  return {
    goal: { id: base.g.id, title: base.g.title, sport: base.g.sport_code, targetDate: base.g.target_date, state: base.g.state },
    decision, athlete: { name: base.a.display_name, timeZone: base.a.time_zone }, today,
    defaultDays: profile?.availableDays.length && profile.availableDays.length >= 2 ? profile.availableDays.slice(0, 6) : [2, 4, 6, 7],
    feasibility, currentWeeklyMin, refs, library,
  };
}

/** Programme calculé pour un lundi de départ et des jours ; le premier lundi à venir par défaut. */
export function buildProgram(ctx: ProgramContext, startMonday: string, days: number[]): Program | null {
  if (!ctx.feasibility) return null;
  return generateProgram({ feasibility: ctx.feasibility, startMonday, days, currentWeeklyMin: ctx.currentWeeklyMin, refs: ctx.refs, goalTitle: ctx.goal.title, library: ctx.library });
}
export const nextMonday = (today: string) => addDays(weekStart(today), 7);

/** Séances déjà prévues sur la période (le programme s’y ajoute, sans les toucher). */
async function existingCount(tx: Tx, wid: string, aid: string, from: string, to: string): Promise<number> {
  const r = await tx.query<{ n: number }>(
    `select count(*)::int as n from public.workouts w join public.workout_revisions r
       on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
     where w.workspace_id = $1 and w.athlete_id = $2 and r.local_date between $3::date and $4::date and not r.canceled`,
    [wid, aid, from, to],
  );
  return r.rows[0]?.n ?? 0;
}

export async function existingInPeriod(userId: string, wid: string, aid: string, from: string, to: string): Promise<number> {
  return readAs(userId, (tx) => existingCount(tx, wid, aid, from, to));
}

/**
 * createProgram · C : crée le programme en brouillons pour un objectif validé par le coach (D-058, D-061).
 * Les risques signalés doivent avoir été lus (acceptRisks) ; rien n’est publié.
 */
export async function createProgram(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; athleteId: string; goalId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(createProgramSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const v = parsed.value as CreateProgramInput;
  const { workspaceId: wid, athleteId: aid, goalId } = meta;
  const ctx = await programContext(meta.actorId, wid, aid, goalId);
  if (!ctx) throw notVisible();
  if (!ctx.decision) throw invalid([{ path: 'goalId', rule: 'Valide d’abord l’objectif (faisabilité, « Ta décision »)' }]);
  if (ctx.goal.state !== 'planned') throw invalid([{ path: 'goalId', rule: 'Cet objectif n’est plus prévu' }]);
  if (!ctx.feasibility) throw invalid([{ path: 'goalId', rule: 'Le bilan de l’élève est nécessaire' }]);
  if (weekStart(v.startMonday) !== v.startMonday || v.startMonday < weekStart(ctx.today)) throw invalid([{ path: 'startMonday', rule: 'Choisis un lundi à venir' }]);
  if (v.startMonday > ctx.feasibility.eventDate) throw invalid([{ path: 'startMonday', rule: 'Le programme doit commencer avant la course' }]);
  const program = buildProgram(ctx, v.startMonday, v.days)!;
  if (program.risks.some((r) => r.level !== 'watch') && !v.acceptRisks) throw invalid([{ path: 'acceptRisks', rule: 'Lis et accepte les risques signalés avant de créer le programme' }]);

  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, aid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'program.create', key: meta.idempotencyKey, body: { aid, goalId, ...v } }, async () => {
      const ends = program.weeks.at(-1)!.sessions.at(-1)?.date ?? ctx.feasibility!.eventDate;
      const plan = await tx.query<{ id: string }>(
        `insert into public.plans(workspace_id, athlete_id, title, starts_on, ends_on, goal_id, generator, created_by)
         values ($1, $2, $3, $4::date, $5::date, $6, $7::jsonb, auth.uid()) returning id`,
        [wid, aid, `Programme · ${ctx.goal.title}`, v.startMonday, ends, goalId,
          JSON.stringify({ version: 1, params: ctx.decision!.params, days: v.days, risks: program.risks, acceptedRisks: v.acceptRisks, startWeekly: program.startWeekly, peakWeekly: program.peakWeekly, longNeed: program.longNeed, currentWeeklyMin: ctx.currentWeeklyMin })],
      );
      const planId = plan.rows[0]!.id;
      await insertBlocks(tx, wid, aid, planId, program);
      let created = 0;
      for (const w of program.weeks) {
        const order = new Map<string, number>();
        for (const x of w.sessions) {
          const so = order.get(x.date) ?? 0;
          order.set(x.date, so + 1);
          await insertGenerated(tx, wid, aid, planId, ctx, w, x, so);
          created++;
        }
      }
      await audit(tx, wid, meta.actorId, 'program.create', planId, meta.requestId);
      return { status: 201, body: { planId, workouts: created, weeks: program.weeks.length } };
    });
  });
}

/** Phases contiguës → blocs du programme. */
async function insertBlocks(tx: Tx, wid: string, aid: string, planId: string, program: Program) {
  let start = 0;
  for (let i = 1; i <= program.weeks.length; i++) {
    const cur = program.weeks[start]!;
    if (i === program.weeks.length || program.weeks[i]!.phase !== cur.phase) {
      const last = program.weeks[i - 1]!;
      await tx.query(
        `insert into public.plan_blocks(workspace_id, athlete_id, plan_id, title, starts_on, ends_on, phase) values ($1, $2, $3, $4, $5::date, $6::date, $7)`,
        [wid, aid, planId, programPhaseTitle(cur.phase, cur.index, last.index), cur.monday, addDays(last.monday, 6), cur.phase],
      );
      start = i;
    }
  }
}

const inputOf = (ctx: ProgramContext, w: Pick<ProgramWeek, 'index' | 'phase'>, x: ProgramSession, sortOrder: number): WorkoutInput => ({
  localDate: x.date, timeZone: ctx.athlete.timeZone, sortOrder, sport: ctx.goal.sport, title: x.title,
  instructions: programInstructions(w, x), durationSeconds: null, distanceM: null, intervals: x.blocks as WorkoutInput['intervals'],
});

/** Brouillon écrit par le générateur : sa révision est notée pour reconnaître plus tard une retouche du coach (D-063). */
async function insertGenerated(tx: Tx, wid: string, aid: string, planId: string, ctx: ProgramContext, w: Pick<ProgramWeek, 'index' | 'phase'>, x: ProgramSession, sortOrder: number) {
  const r = await tx.query<{ id: string }>(
    'insert into public.workouts(workspace_id, athlete_id, working_revision, plan_id, generated_revision) values ($1, $2, 1, $3, 1) returning id', [wid, aid, planId],
  );
  await insertRevision(tx, wid, aid, r.rows[0]!.id, 1, inputOf(ctx, w, x, sortOrder));
}

// ——— D-063 : régénération partielle ———

export interface GoalPlan { id: string; title: string; startsOn: string; endsOn: string; days: number[]; createdAt: string; regenerations: number }

/** Programmes générés pour cet objectif, du plus récent au plus ancien. */
export async function readGoalPlans(userId: string, wid: string, aid: string, goalId: string): Promise<GoalPlan[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; title: string; starts_on: string; ends_on: string; generator: { days?: number[]; regenerations?: unknown[] }; created_at: Date }>(
      `select id, title, to_char(starts_on, 'YYYY-MM-DD') as starts_on, to_char(ends_on, 'YYYY-MM-DD') as ends_on, generator, created_at
       from public.plans where workspace_id = $1 and athlete_id = $2 and goal_id = $3 and generator is not null order by created_at desc`,
      [wid, aid, goalId],
    );
    return r.rows.map((x) => ({
      id: x.id, title: x.title, startsOn: x.starts_on, endsOn: x.ends_on, days: x.generator.days ?? [2, 4, 6, 7],
      createdAt: new Date(x.created_at).toISOString(), regenerations: x.generator.regenerations?.length ?? 0,
    }));
  });
}

interface PlanRow { id: string; goal_id: string; starts_on: string; generator: { days?: number[]; currentWeeklyMin?: number | null; startWeekly?: number; regenerations?: unknown[] } & Record<string, unknown> }

async function planRow(tx: Tx, wid: string, aid: string, planId: string): Promise<PlanRow | null> {
  const r = await tx.query<PlanRow>(
    `select id, goal_id, to_char(starts_on, 'YYYY-MM-DD') as starts_on, generator from public.plans
     where workspace_id = $1 and athlete_id = $2 and id = $3 and generator is not null`, [wid, aid, planId],
  );
  return r.rows[0] ?? null;
}

async function plannedSessions(tx: Tx, wid: string, aid: string, planId: string): Promise<PlannedSession[]> {
  const r = await tx.query<{ id: string; working_revision: number; generated_revision: number | null; published_revision: number | null; local_date: string; title: string; intervals: unknown; canceled: boolean; done: boolean }>(
    `select w.id, w.working_revision, w.generated_revision, w.published_revision, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.title, r.intervals, r.canceled,
            exists (select 1 from public.workout_results res where res.workspace_id = w.workspace_id and res.athlete_id = w.athlete_id and res.workout_id = w.id) as done
     from public.workouts w
     join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
     where w.workspace_id = $1 and w.athlete_id = $2 and w.plan_id = $3
     order by r.local_date, r.sort_order, w.created_at`,
    [wid, aid, planId],
  );
  return r.rows.map((x) => ({
    id: x.id, revision: x.working_revision, date: x.local_date, title: x.title, blocks: (Array.isArray(x.intervals) ? x.intervals : []) as Block[],
    canceled: x.canceled, done: x.done, edited: x.generated_revision !== x.working_revision, published: x.published_revision !== null,
  }));
}

export interface RegenContext { ctx: ProgramContext; plan: { id: string; startMonday: string; days: number[]; currentWeeklyMin: number | null }; old: PlannedSession[] }

/** Tout ce qu’il faut pour régénérer une partie d’un programme. null si non visible. */
export async function regenContext(userId: string, wid: string, aid: string, planId: string): Promise<RegenContext | null> {
  const got = await readAs(userId, async (tx) => {
    const p = await planRow(tx, wid, aid, planId);
    return p ? { p, old: await plannedSessions(tx, wid, aid, planId) } : null;
  });
  if (!got) return null;
  const ctx = await programContext(userId, wid, aid, got.p.goal_id);
  if (!ctx) return null;
  const g = got.p.generator;
  return {
    ctx, old: got.old,
    plan: { id: got.p.id, startMonday: got.p.starts_on, days: g.days ?? ctx.defaultDays, currentWeeklyMin: 'currentWeeklyMin' in g ? g.currentWeeklyMin ?? null : g.startWeekly ?? null },
  };
}

/**
 * Programme recalculé depuis le même lundi de départ et le même volume de départ que la création : les phases restent
 * alignées ; les paramètres validés, les jours et la bibliothèque sont ceux d’aujourd’hui.
 */
export function buildRegeneration(rc: RegenContext, days: number[], fromWeek: number, toWeek: number): { program: Program; regen: Regeneration; weekCount: number } | null {
  if (!rc.ctx.feasibility) return null;
  const program = generateProgram({
    feasibility: rc.ctx.feasibility, startMonday: rc.plan.startMonday, days, currentWeeklyMin: rc.plan.currentWeeklyMin,
    refs: rc.ctx.refs, goalTitle: rc.ctx.goal.title, library: rc.ctx.library,
  });
  const weekCount = regenWeekCount(rc.old, program, rc.plan.startMonday);
  const to = Math.min(toWeek, weekCount);
  const regen = planRegeneration({ old: rc.old, program, startMonday: rc.plan.startMonday, fromWeek: Math.min(fromWeek, to), toWeek: to, today: rc.ctx.today });
  return { program, regen, weekCount };
}

/** Séances du programme dans les semaines demandées, telles que vues dans l’aperçu (contrôle de concurrence). */
export function seenOf(regen: Regeneration): { id: string; revision: number }[] {
  return regen.weeks.flatMap((w) => w.items).flatMap((it) => ('before' in it ? [{ id: it.before.id, revision: it.before.revision }] : []));
}

/**
 * regenerateProgram · C : régénère les semaines demandées (CE-P-06, D-063). Séances passées, réalisées ou retouchées
 * protégées ; les autres sont modifiées, retirées (annulation) ou ajoutées en brouillons. Une séance déjà publiée reçoit
 * une nouvelle version de travail : l’élève garde la version publiée jusqu’à la republication par le coach.
 */
export async function regenerateProgram(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; athleteId: string; planId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(regenerateProgramSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const v = parsed.value as RegenerateProgramInput;
  const { workspaceId: wid, athleteId: aid, planId } = meta;
  const rc = await regenContext(meta.actorId, wid, aid, planId);
  if (!rc) throw notVisible();
  if (!rc.ctx.decision) throw invalid([{ path: 'planId', rule: 'Valide d’abord l’objectif (faisabilité, « Ta décision »)' }]);
  if (!rc.ctx.feasibility) throw invalid([{ path: 'planId', rule: 'Le bilan de l’élève est nécessaire' }]);
  const built = buildRegeneration(rc, v.days, v.fromWeek, v.toWeek)!;
  if (built.program.risks.some((r) => r.level !== 'watch') && !v.acceptRisks) throw invalid([{ path: 'acceptRisks', rule: 'Lis et accepte les risques signalés avant de régénérer' }]);

  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, aid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'program.regenerate', key: meta.idempotencyKey, body: { planId, ...v } }, async () => {
      const plan = await tx.query<{ id: string }>('select id from public.plans where workspace_id = $1 and id = $2 for update', [wid, planId]);
      if (!plan.rows[0]) throw notVisible();
      await tx.query('select 1 from public.workouts where workspace_id = $1 and plan_id = $2 for update', [wid, planId]);
      // L’aperçu doit être encore valable : mêmes séances, mêmes révisions.
      const now = await plannedSessions(tx, wid, aid, planId);
      const regen = planRegeneration({ old: now, program: built.program, startMonday: rc.plan.startMonday, fromWeek: built.regen.weeks[0]?.index ?? v.fromWeek, toWeek: built.regen.weeks.at(-1)?.index ?? v.toWeek, today: rc.ctx.today });
      const seen = new Map(v.seen.map((x) => [x.id, x.revision]));
      const cur = seenOf(regen);
      if (cur.length !== v.seen.length || cur.some((x) => seen.get(x.id) !== x.revision)) {
        throw conflict('Le programme a changé depuis l’aperçu. Recharge la page pour revoir les différences.', {});
      }
      const byId = new Map(now.map((x) => [x.id, x]));
      const bump = async (id: string, n: number) =>
        tx.query('update public.workouts set working_revision = $4, generated_revision = $4 where workspace_id = $1 and athlete_id = $2 and id = $3', [wid, aid, id, n]);
      for (const w of regen.weeks) {
        const pw = built.program.weeks[w.index - 1];
        const wk = { index: w.index, phase: pw?.phase ?? 'developpement' as const };
        for (const it of w.items) {
          if (it.kind === 'changed') {
            const n = it.before.revision + 1;
            await insertRevision(tx, wid, aid, it.before.id, n, inputOf(rc.ctx, wk, it.after, 0));
            await bump(it.before.id, n);
          } else if (it.kind === 'removed') {
            const o = byId.get(it.before.id)!;
            const n = o.revision + 1;
            await insertRevision(tx, wid, aid, o.id, n, {
              localDate: o.date, timeZone: rc.ctx.athlete.timeZone, sortOrder: 0, sport: rc.ctx.goal.sport, title: o.title, instructions: null,
              durationSeconds: null, distanceM: null, intervals: o.blocks as WorkoutInput['intervals'],
            }, 'Retirée : programme régénéré');
            await bump(o.id, n);
          } else if (it.kind === 'added') {
            await insertGenerated(tx, wid, aid, planId, rc.ctx, wk, it.after, 0);
          }
        }
      }
      // Programme : jours, paramètres et risques du jour, trace de la régénération ; phases recalculées.
      const g = (await planRow(tx, wid, aid, planId))!.generator;
      const entry = { at: new Date().toISOString(), by: meta.actorId, fromWeek: regen.weeks[0]?.index ?? v.fromWeek, toWeek: regen.weeks.at(-1)?.index ?? v.toWeek, days: v.days, counts: regen.counts, acceptedRisks: v.acceptRisks };
      const ends = built.program.weeks.at(-1)?.sessions.at(-1)?.date ?? rc.ctx.feasibility!.eventDate;
      await tx.query(
        `update public.plans set generator = $3::jsonb, ends_on = greatest(ends_on, $4::date) where workspace_id = $1 and id = $2`,
        [wid, planId, JSON.stringify({ ...g, days: v.days, params: rc.ctx.decision!.params, risks: built.program.risks, regenerations: [...(g.regenerations ?? []), entry] }), ends],
      );
      await tx.query('delete from public.plan_blocks where workspace_id = $1 and plan_id = $2', [wid, planId]);
      await insertBlocks(tx, wid, aid, planId, built.program);
      await audit(tx, wid, meta.actorId, 'program.regenerate', planId, meta.requestId);
      return { status: 200, body: { planId, ...regen.counts } };
    });
  });
}
