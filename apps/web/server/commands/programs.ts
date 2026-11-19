import {
  addDays, createProgramSchema, generateProgram, parseWith, todayIn, weekStart,
  type CreateProgramInput, type FeasibilityInput, type Program, type ProgramPhase, type WorkoutInput,
} from '@coachos/domain';
import { commandAs, readAs, type Tx } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned } from './portfolio';
import { insertRevision } from './workouts';
import { readAthleteProfile } from './athlete-profile';
import { readAthleteReferences } from './athlete-references';
import { readPerformances } from './performances';
import { readGoalDecisions, type GoalDecision } from './goal-decisions';
import { athleteStats } from '../repo/stats';

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
  const [profile, refs, perfs, decisions] = await Promise.all([
    readAthleteProfile(userId, wid, aid), readAthleteReferences(userId, wid, aid), readPerformances(userId, wid, aid), readGoalDecisions(userId, wid, aid),
  ]);
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
    feasibility, currentWeeklyMin, refs,
  };
}

/** Programme calculé pour un lundi de départ et des jours ; le premier lundi à venir par défaut. */
export function buildProgram(ctx: ProgramContext, startMonday: string, days: number[]): Program | null {
  if (!ctx.feasibility) return null;
  return generateProgram({ feasibility: ctx.feasibility, startMonday, days, currentWeeklyMin: ctx.currentWeeklyMin, refs: ctx.refs, goalTitle: ctx.goal.title });
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
          JSON.stringify({ version: 1, params: ctx.decision!.params, days: v.days, risks: program.risks, acceptedRisks: v.acceptRisks, startWeekly: program.startWeekly, peakWeekly: program.peakWeekly, longNeed: program.longNeed })],
      );
      const planId = plan.rows[0]!.id;
      // Phases contiguës → blocs du programme.
      let start = 0;
      for (let i = 1; i <= program.weeks.length; i++) {
        const cur = program.weeks[start]!;
        if (i === program.weeks.length || program.weeks[i]!.phase !== cur.phase) {
          const last = program.weeks[i - 1]!;
          await tx.query(
            `insert into public.plan_blocks(workspace_id, athlete_id, plan_id, title, starts_on, ends_on, phase) values ($1, $2, $3, $4, $5::date, $6::date, $7)`,
            [wid, aid, planId, phaseTitle(cur.phase, cur.index, last.index), cur.monday, addDays(last.monday, 6), cur.phase],
          );
          start = i;
        }
      }
      let created = 0;
      for (const w of program.weeks) {
        const order = new Map<string, number>();
        for (const s of w.sessions) {
          const so = order.get(s.date) ?? 0;
          order.set(s.date, so + 1);
          const r = await tx.query<{ id: string }>('insert into public.workouts(workspace_id, athlete_id, working_revision, plan_id) values ($1, $2, 1, $3) returning id', [wid, aid, planId]);
          const input: WorkoutInput = {
            localDate: s.date, timeZone: ctx.athlete.timeZone, sortOrder: so, sport: ctx.goal.sport, title: s.title,
            instructions: `Semaine ${w.index} · ${phaseTitle(w.phase, w.index, w.index)}`, durationSeconds: null, distanceM: null,
            intervals: s.blocks as WorkoutInput['intervals'],
          };
          await insertRevision(tx, wid, aid, r.rows[0]!.id, 1, input);
          created++;
        }
      }
      await audit(tx, wid, meta.actorId, 'program.create', planId, meta.requestId);
      return { status: 201, body: { planId, workouts: created, weeks: program.weeks.length } };
    });
  });
}

function phaseTitle(p: ProgramPhase, from: number, to: number): string {
  const name = { tremplin: 'Tremplin', developpement: 'Développement', recuperation: 'Semaine allégée', affutage: 'Affûtage' }[p];
  return from === to ? `${name} (semaine ${from})` : `${name} (semaines ${from} à ${to})`;
}
