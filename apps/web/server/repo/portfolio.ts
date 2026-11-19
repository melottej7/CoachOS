import {
  addDays, AUTO_RULE_INFO, autoRuleReason, bilanCompletion, deriveBilan, excerpt, resolveRuleSettings, type BilanAnswers, rankTasks, todayIn, urgencyScore, usesVma, utcToLocal,
  type AppointmentKind, type AppointmentStatus, type AutoRule, type AutoRuleSetting, type TaskRecurrence, type GoalState, type Level, type LocalDate, type Sport, type TaskKind, type TaskStatus,
} from '@coachos/domain';
import { readAs, type Tx } from '../db/client';
import { apptCols, toAppt, type AppointmentItem, type ApptRow } from '../commands/tasks';

// Lectures des lots G et H (D-032), toutes sous RLS : un coach ne voit que ses élèves affectés.

export interface TeamRef { id: string; name: string }
export interface TeamSummary extends TeamRef {
  sortOrder: number; archived: boolean; members: number; openReviews: number; withoutUpcoming: number;
  /** Régularité du groupe sur 4 semaines : séances faites / prévues, tous membres confondus (D-043). */
  regularity: number | null;
}

/** Une tâche à faire, humaine ou calculée (suivi automatique), avec son motif. */
export interface HomeTask {
  key: string;
  source: 'manual' | 'auto';
  id: string | null;
  rule: AutoRule | null;
  ref: string;
  title: string;
  reason: string;
  kind: TaskKind;
  priority: number;
  dueOn: string | null;
  status: TaskStatus;
  revision: number | null;
  /** Fuseau connu pour les suivis automatiques (planification d’un appel). */
  athlete: { id: string; name: string; timeZone?: string } | null;
  team: TeamRef | null;
  link: string | null;
  notes: string | null;
  /** Tâche récurrente (CE-H-06, D-059). */
  recurrence?: TaskRecurrence | null;
  /** Créneau de travail et durée estimée (D-065), tâches humaines seulement. */
  slotOn?: string | null;
  slotTime?: string | null;
  estimateMin?: number | null;
}

export interface RosterEntry {
  id: string;
  name: string;
  timeZone: string;
  state: 'invited' | 'active';
  teams: TeamRef[];
  sport: Sport | null;
  declaredLevel: Level | null;
  levels: { sport: Sport; level: Level }[];
  vmaKmh: number | null;
  openReviews: number;
  /** Régularité des 4 dernières semaines (séances publiées passées, D-043) : faites / prévues, effort moyen déclaré. */
  regularity: { due: number; done: number; pct: number | null; avgRpe: number | null };
  nextWorkout: string | null;
  upcoming7: number;
  /** Prochain objectif prévu (date à venir d’abord, puis sans date), pour filtrer et afficher (D-053). */
  nextGoal: { title: string; targetDate: string | null } | null;
  todo: HomeTask[];
  urgency: number;
}

type AthleteRow = { id: string; display_name: string; time_zone: string; state: 'invited' | 'active'; created_at: Date };

async function snoozed(tx: Tx, wid: string): Promise<Map<string, string | null>> {
  const r = await tx.query<{ rule: string; source_ref: string; snoozed_until: string | null }>(
    `select rule, source_ref, to_char(snoozed_until, 'YYYY-MM-DD') as snoozed_until from public.auto_task_states where workspace_id = $1`,
    [wid],
  );
  return new Map(r.rows.map((x) => [`${x.rule}:${x.source_ref}`, x.snoozed_until]));
}

/** Réglages des suivis du coach connecté (CE-H-04), valeurs par défaut sinon. */
export async function ruleSettingsIn(tx: Tx, wid: string): Promise<Record<AutoRule, AutoRuleSetting>> {
  const r = await tx.query<{ rule: string; enabled: boolean; delay_days: number | null }>(
    'select rule, enabled, delay_days from public.auto_rule_settings where workspace_id = $1 and coach_id = auth.uid()',
    [wid],
  );
  return resolveRuleSettings(r.rows);
}

export async function autoRuleSettings(userId: string, wid: string): Promise<Record<AutoRule, AutoRuleSetting>> {
  return readAs(userId, (tx) => ruleSettingsIn(tx, wid));
}

async function manualTasks(tx: Tx, wid: string, open: boolean): Promise<(HomeTask & { athleteId: string | null; teamId: string | null })[]> {
  const r = await tx.query<{
    id: string; title: string; kind: TaskKind; athlete_id: string | null; display_name: string | null; team_id: string | null; team_name: string | null;
    due_on: string | null; priority: number; status: TaskStatus; link: string | null; notes: string | null; revision: number; recurrence: TaskRecurrence | null;
    slot_on: string | null; slot_time: string | null; estimate_min: number | null;
  }>(
    `select t.id, t.title, t.kind, t.athlete_id, a.display_name, t.team_id, tm.name as team_name, to_char(t.due_on, 'YYYY-MM-DD') as due_on,
            t.priority, t.status, t.link, t.notes, t.revision, t.recurrence,
            to_char(t.slot_on, 'YYYY-MM-DD') as slot_on, to_char(t.slot_time, 'HH24:MI') as slot_time, t.estimate_min
     from public.coach_tasks t
     left join public.athletes a on a.workspace_id = t.workspace_id and a.id = t.athlete_id
     left join public.teams tm on tm.workspace_id = t.workspace_id and tm.id = t.team_id
     where t.workspace_id = $1 and ($2::boolean is false or t.status in ('todo','in_progress','waiting','postponed'))
     order by t.due_on nulls last, t.priority desc, t.created_at`,
    [wid, open],
  );
  return r.rows.map((t) => ({
    key: `task:${t.id}`, source: 'manual', id: t.id, rule: null, ref: t.id, title: t.title, reason: t.status === 'waiting' ? 'En attente' : t.status === 'in_progress' ? 'En cours' : t.status === 'postponed' ? 'Reportée' : 'Tâche',
    kind: t.kind, priority: Number(t.priority), dueOn: t.due_on, status: t.status, revision: t.revision,
    athlete: t.athlete_id ? { id: t.athlete_id, name: t.display_name ?? '' } : null, team: t.team_id ? { id: t.team_id, name: t.team_name ?? '' } : null,
    link: t.link, notes: t.notes, athleteId: t.athlete_id, teamId: t.team_id, recurrence: t.recurrence,
    slotOn: t.slot_on, slotTime: t.slot_time, estimateMin: t.estimate_min === null ? null : Number(t.estimate_min),
  }));
}

/**
 * Portefeuille complet : élèves affectés, groupes, niveaux, couverture des 7 prochains jours,
 * suivis automatiques (dédoublonnés par règle et objet, clos quand l’objet est résolu) et tâches.
 */
async function loadRoster(tx: Tx, wid: string, today: LocalDate, tz: string): Promise<{ roster: RosterEntry[]; tasks: (HomeTask & { athleteId: string | null; teamId: string | null })[] }> {
  const base = `/coach/${wid}`;
  const end = addDays(today, 6);
  const athletes = (await tx.query<AthleteRow>(
    `select id, display_name, time_zone, state, created_at from public.athletes where workspace_id = $1 and state <> 'archived' order by display_name, id`,
    [wid],
  )).rows;
  const ids = athletes.map((a) => a.id);
  const q = async <T>(sql: string, extra: unknown[] = []) => (await tx.query<T>(sql, [wid, ids, ...extra])).rows;
  // Requêtes enchaînées : une transaction ne traite qu’une requête à la fois.
  const teams = await q<{ athlete_id: string; id: string; name: string }>(
      `select ta.athlete_id, t.id, t.name from public.team_athletes ta join public.teams t on t.workspace_id = ta.workspace_id and t.id = ta.team_id
       where ta.workspace_id = $1 and ta.athlete_id = any($2::uuid[]) and t.archived_at is null order by t.sort_order, t.name`);
  const profiles = await q<{ athlete_id: string; sport_code: Sport; level: Level; updated_at: Date; status: 'submitted' | 'confirmed' }>(`select athlete_id, sport_code, level, updated_at, status from public.athlete_profiles where workspace_id = $1 and athlete_id = any($2::uuid[])`);
  const levels = await q<{ athlete_id: string; sport_code: Sport; level: Level }>(`select athlete_id, sport_code, level from public.athlete_sport_levels where workspace_id = $1 and athlete_id = any($2::uuid[]) order by sport_code`);
  const refs = await q<{ athlete_id: string; vma_kmh: string | null }>(`select athlete_id, vma_kmh from public.athlete_references where workspace_id = $1 and athlete_id = any($2::uuid[])`);
  const reviews = await q<{ id: string; athlete_id: string; created_at: Date; title: string | null }>(
      `select ri.id, ri.athlete_id, ri.created_at, rev.title
       from public.review_items ri
       join public.feedbacks f on f.workspace_id = ri.workspace_id and f.athlete_id = ri.athlete_id and f.id = ri.source_ref
       join public.workout_results res on res.workspace_id = f.workspace_id and res.athlete_id = f.athlete_id and res.id = f.result_id
       left join public.workout_revisions rev on rev.workspace_id = res.workspace_id and rev.athlete_id = res.athlete_id
            and rev.workout_id = res.workout_id and rev.number = res.workout_revision
       where ri.workspace_id = $1 and ri.athlete_id = any($2::uuid[]) and ri.state = 'open' and ri.kind = 'feedback' and f.reviewed_at is null`);
  const workouts = await q<{ athlete_id: string; local_date: string }>(
      `select w.athlete_id, to_char(r.local_date, 'YYYY-MM-DD') as local_date
       from public.workouts w join public.workout_revisions r
         on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.published_revision
       where w.workspace_id = $1 and w.athlete_id = any($2::uuid[]) and w.published_revision is not null and not r.canceled and r.local_date >= $3::date
       order by r.local_date`, [today]);
  const lastFromAthlete = await q<{ athlete_id: string; conversation_id: string; created_at: Date; body: string }>(
    `select c.athlete_id, c.id as conversation_id, lm.created_at, lm.body
     from public.conversations c
     join public.athletes a on a.workspace_id = c.workspace_id and a.id = c.athlete_id
     join lateral (select m.created_at, m.body, m.sender_id from public.messages m
                   where m.workspace_id = c.workspace_id and m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1) lm on true
     where c.workspace_id = $1 and c.athlete_id = any($2::uuid[]) and lm.sender_id = a.user_id
       -- Écrit par un coach de l’espace (même s’il est aussi l’élève de cette fiche) : rien à répondre.
       and not exists (select 1 from public.memberships mb where mb.workspace_id = c.workspace_id and mb.user_id = lm.sender_id and mb.active)`);
  // Régularité sur 28 jours (D-043) : mêmes règles que le suivi de l’entraînement (publiées, non annulées, passées).
  const reg = await q<{ athlete_id: string; due: number; done: number; rpe: string | null }>(
    `select w.athlete_id, count(*)::int as due, count(*) filter (where res.state in ('completed','partial'))::int as done,
            round(avg(f.rpe) filter (where res.state in ('completed','partial')), 1)::text as rpe
     from public.workouts w
     join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.published_revision
     left join public.workout_results res on res.workspace_id = w.workspace_id and res.athlete_id = w.athlete_id and res.workout_id = w.id
     left join public.feedbacks f on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
     where w.workspace_id = $1 and w.athlete_id = any($2::uuid[]) and w.published_revision is not null and not r.canceled
       and r.local_date between $3::date and $4::date
     group by w.athlete_id`, [addDays(today, -27), today]);
  const regBy = new Map(reg.map((x) => [x.athlete_id, x]));
  // Élèves ayant déjà un rendez-vous (prévu ou fait) : l’appel de bienvenue n’est plus à planifier.
  const drafts = new Map((await q<{ athlete_id: string; answers: BilanAnswers }>(
    `select athlete_id, answers from public.athlete_profile_drafts where workspace_id = $1 and athlete_id = any($2::uuid[])`)).map((d) => [d.athlete_id, bilanCompletion(deriveBilan(d.answers))]));
  const goals = await q<{ athlete_id: string; title: string; target_date: string | null }>(
    `select distinct on (athlete_id) athlete_id, title, to_char(target_date, 'YYYY-MM-DD') as target_date from public.goals
     where workspace_id = $1 and athlete_id = any($2::uuid[]) and state = 'planned' and (target_date is null or target_date >= $3::date)
     order by athlete_id, (target_date is null), target_date, created_at desc`, [today]);
  const goalBy = new Map(goals.map((g) => [g.athlete_id, { title: g.title, targetDate: g.target_date }]));
  const met = new Set((await q<{ athlete_id: string }>(
    `select distinct athlete_id from public.appointments where workspace_id = $1 and athlete_id = any($2::uuid[]) and status <> 'canceled'`)).map((x) => x.athlete_id));
  const snooze = await snoozed(tx, wid);
  const settings = await ruleSettingsIn(tx, wid);
  const delay = (rule: AutoRule) => settings[rule].delayDays ?? 0;
  const horizonEnd = addDays(today, delay('no_upcoming') - 1);
  const tasks = await manualTasks(tx, wid, true);
  const by = <T extends { athlete_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of rows) m.set(x.athlete_id, [...(m.get(x.athlete_id) ?? []), x]);
    return m;
  };
  const teamsBy = by(teams), profileBy = by(profiles), levelsBy = by(levels), refsBy = by(refs), reviewsBy = by(reviews), workoutsBy = by(workouts), msgBy = by(lastFromAthlete);
  const localDay = (d: Date) => todayIn(tz, d);

  const roster: RosterEntry[] = athletes.map((a) => {
    const profile = profileBy.get(a.id)?.[0] ?? null;
    const confirmed = (levelsBy.get(a.id) ?? []).map((l) => ({ sport: l.sport_code, level: l.level }));
    const vmaRaw = refsBy.get(a.id)?.[0]?.vma_kmh ?? null;
    const vmaKmh = vmaRaw === null ? null : Number(vmaRaw);
    const upcoming = (workoutsBy.get(a.id) ?? []).map((w) => w.local_date);
    const upcoming7 = upcoming.filter((d) => d <= end).length;
    const athleteRef = { id: a.id, name: a.display_name, timeZone: a.time_zone };
    const auto: HomeTask[] = [];
    const push = (rule: AutoRule, ref: string, dueOn: string | null, link: string, detail?: string | null) => {
      if (!settings[rule].enabled) return;
      const until = snooze.get(`${rule}:${ref}`);
      if (until && until > today) return;
      const info = AUTO_RULE_INFO[rule];
      auto.push({
        key: `auto:${rule}:${ref}`, source: 'auto', id: null, rule, ref, title: info.title, reason: detail ? `${autoRuleReason(rule, settings[rule])} · ${detail}` : autoRuleReason(rule, settings[rule]),
        kind: info.kind, priority: info.priority, dueOn, status: 'todo', revision: null, athlete: athleteRef, team: null, link, notes: null,
      });
    };
    for (const m of msgBy.get(a.id) ?? []) push('message_reply', m.conversation_id, addDays(localDay(m.created_at), delay('message_reply')), `${base}/messages/${a.id}`, `« ${excerpt(m.body, 60)} »`);
    for (const rv of reviewsBy.get(a.id) ?? []) push('feedback_review', rv.id, addDays(localDay(rv.created_at), delay('feedback_review')), `${base}/review/${rv.id}`, rv.title);
    if (a.state === 'invited') push('invite_pending', a.id, addDays(localDay(a.created_at), delay('invite_pending')), `${base}/athletes/${a.id}#inv-title`);
    if (a.state === 'active') {
      if (!upcoming.some((d) => d <= horizonEnd)) push('no_upcoming', a.id, today, `${base}/calendar?athlete=${a.id}`);
      if (!profile) {
        const d = drafts.get(a.id);
        push('profile_missing', a.id, null, `${base}/athletes/${a.id}#bilan`, d ? `bilan commencé, ${d.answered} réponse${d.answered > 1 ? 's' : ''} sur ${d.total}` : null);
      }
      if (profile && !met.has(a.id)) push('onboarding_call', a.id, addDays(localDay(profile.updated_at), delay('onboarding_call')), `${base}/athletes/${a.id}#rdv`);
      // D-059 : un bilan envoyé se confirme en un geste (le niveau déclaré avec) ; « Confirmer le niveau » ne double pas cette tâche.
      if (profile?.status === 'submitted') push('bilan_confirm', a.id, addDays(localDay(profile.updated_at), delay('bilan_confirm')), `${base}/athletes/${a.id}#bilan`);
      else if (profile && !confirmed.some((l) => l.sport === profile.sport_code)) push('level_unconfirmed', a.id, null, `${base}/athletes/${a.id}#levels`);
      if (profile && usesVma(profile.sport_code) && vmaKmh === null) push('vma_missing', a.id, null, `${base}/athletes/${a.id}#refs-title`);
    }
    const own = tasks.filter((t) => t.athleteId === a.id);
    const todo = rankTasks([...auto, ...own], today);
    return {
      id: a.id, name: a.display_name, timeZone: a.time_zone, state: a.state,
      teams: (teamsBy.get(a.id) ?? []).map((t) => ({ id: t.id, name: t.name })),
      sport: profile?.sport_code ?? null, declaredLevel: profile?.level ?? null, levels: confirmed, vmaKmh,
      openReviews: (reviewsBy.get(a.id) ?? []).length,
      regularity: (() => {
        const x = regBy.get(a.id);
        return x ? { due: x.due, done: x.done, pct: x.due ? Math.round((x.done / x.due) * 100) : null, avgRpe: x.rpe === null ? null : Number(x.rpe) } : { due: 0, done: 0, pct: null, avgRpe: null };
      })(),
      nextWorkout: upcoming[0] ?? null, upcoming7, nextGoal: goalBy.get(a.id) ?? null, todo,
      urgency: urgencyScore(todo, today),
    };
  });
  return { roster, tasks };
}

export interface PortfolioView { today: LocalDate; roster: RosterEntry[]; teams: TeamSummary[] }

/** Lot G : élèves, groupes et indicateurs par groupe (effectif, retours, élèves sans séance sur 7 jours). */
export async function portfolio(userId: string, wid: string, tz: string): Promise<PortfolioView> {
  const today = todayIn(tz);
  return readAs(userId, async (tx) => {
    const { roster } = await loadRoster(tx, wid, today, tz);
    const t = await tx.query<{ id: string; name: string; sort_order: number; archived_at: Date | null }>(
      'select id, name, sort_order, archived_at from public.teams where workspace_id = $1 order by archived_at nulls first, sort_order, name',
      [wid],
    );
    const teams = t.rows.map((x) => {
      const members = roster.filter((a) => a.teams.some((m) => m.id === x.id));
      return {
        id: x.id, name: x.name, sortOrder: x.sort_order, archived: x.archived_at !== null, members: members.length,
        openReviews: members.reduce((n, a) => n + a.openReviews, 0), withoutUpcoming: members.filter((a) => a.state === 'active' && !a.upcoming7).length,
        regularity: (() => {
          const due = members.reduce((n, a) => n + a.regularity.due, 0);
          return due ? Math.round((members.reduce((n, a) => n + a.regularity.done, 0) / due) * 100) : null;
        })(),
      };
    });
    return { today, roster, teams };
  });
}

export interface AgendaSlot { key: string; title: string; time: string | null; estimateMin: number | null; athlete: { id: string; name: string } | null }
export interface AgendaDay { date: LocalDate; appointments: (AppointmentItem & { athleteName: string; localTime: string })[]; tasksDue: number; sessions: number; slots: AgendaSlot[] }
export interface HomeView { today: LocalDate; tasks: HomeTask[]; week: AgendaDay[]; roster: RosterEntry[]; teams: TeamRef[] }

/** Lot H : tâches classées (humaines et automatiques) et agenda de la semaine du coach. */
export async function home(userId: string, wid: string, tz: string, monday: LocalDate): Promise<HomeView> {
  const today = todayIn(tz);
  return readAs(userId, async (tx) => {
    const { roster, tasks } = await loadRoster(tx, wid, today, tz);
    const auto = roster.flatMap((a) => a.todo.filter((t) => t.source === 'auto'));
    const snooze = await snoozed(tx, wid);
    const replyRule = (await ruleSettingsIn(tx, wid)).message_reply;
    const teamMsgs = await tx.query<{ team_id: string; name: string; created_at: Date; body: string }>(
      `select t.id as team_id, t.name, lm.created_at, lm.body from public.teams t
       join lateral (select created_at, body, sender_role from public.team_messages m
                     where m.workspace_id = t.workspace_id and m.team_id = t.id order by created_at desc, id desc limit 1) lm on true
       where t.workspace_id = $1 and t.archived_at is null and lm.sender_role = 'athlete'`,
      [wid],
    );
    for (const m of replyRule.enabled ? teamMsgs.rows : []) {
      const until = snooze.get(`message_reply:${m.team_id}`);
      if (until && until > today) continue;
      const info = AUTO_RULE_INFO.message_reply;
      auto.push({
        key: `auto:message_reply:${m.team_id}`, source: 'auto', id: null, rule: 'message_reply', ref: m.team_id, title: 'Répondre au groupe',
        reason: `Message dans le groupe · « ${excerpt(m.body, 60)} »`, kind: info.kind, priority: info.priority,
        dueOn: addDays(todayIn(tz, m.created_at), replyRule.delayDays ?? 1), status: 'todo', revision: null, athlete: null, team: { id: m.team_id, name: m.name },
        link: `/coach/${wid}/messages/groupe/${m.team_id}`, notes: null,
      });
    }
    const all = rankTasks([...auto, ...tasks], today);
    const sunday = addDays(monday, 6);
    const appts = await tx.query<ApptRow & { display_name: string }>(
      `select ${apptCols.split(', ').map((c) => `ap.${c}`).join(', ')}, a.display_name
       from public.appointments ap join public.athletes a on a.workspace_id = ap.workspace_id and a.id = ap.athlete_id
       where ap.workspace_id = $1 and ap.coach_id = auth.uid() and ap.status <> 'canceled'
         and ap.starts_at >= ($2::date - interval '1 day') and ap.starts_at < ($3::date + interval '2 day')
       order by ap.starts_at`,
      [wid, monday, sunday],
    );
    const sessions = await tx.query<{ local_date: string; n: number }>(
      `select to_char(r.local_date, 'YYYY-MM-DD') as local_date, count(*)::int as n
       from public.workouts w join public.workout_revisions r
         on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.published_revision
       join public.athletes a on a.workspace_id = w.workspace_id and a.id = w.athlete_id and a.state <> 'archived'
       where w.workspace_id = $1 and not r.canceled and r.local_date between $2::date and $3::date
       group by r.local_date`,
      [wid, monday, sunday],
    );
    const perDay = new Map(sessions.rows.map((s) => [s.local_date, s.n]));
    const items = appts.rows.map((x) => {
      const a = toAppt(x);
      const local = utcToLocal(new Date(a.startsAt), tz);
      return { ...a, athleteName: x.display_name, localTime: local.time, localDate: local.date };
    });
    const week: AgendaDay[] = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return {
        date,
        appointments: items.filter((x) => x.localDate === date).map(({ localDate: _d, ...rest }) => rest),
        tasksDue: all.filter((t) => t.dueOn === date).length,
        sessions: perDay.get(date) ?? 0,
        // D-065 : créneaux de travail du jour (à l’heure d’abord), distincts des rendez-vous à horaire fixe.
        slots: all.filter((t) => t.slotOn === date)
          .sort((a, b) => (a.slotTime ?? '99').localeCompare(b.slotTime ?? '99'))
          .map((t) => ({ key: t.key, title: t.title, time: t.slotTime ?? null, estimateMin: t.estimateMin ?? null, athlete: t.athlete })),
      };
    });
    const teams = (await tx.query<TeamRef>('select id, name from public.teams where workspace_id = $1 and archived_at is null order by sort_order, name', [wid])).rows;
    return { today, tasks: all, week, roster, teams };
  });
}

export interface GoalItem { id: string; title: string; sport: Sport; targetDate: string | null; state: GoalState }
export interface NoteItem { id: string; body: string; createdAt: string }
export interface AthleteFileView {
  entry: RosterEntry | null;
  allTeams: TeamRef[];
  goals: GoalItem[];
  notes: NoteItem[];
  appointments: AppointmentItem[];
  upcoming: { id: string; title: string; localDate: string; published: boolean; sport: Sport }[];
  recentFeedback: { workoutId: string; title: string; localDate: string; state: string; reviewed: boolean }[];
  closedTasks: number;
}

/** Fiche élève centrale (CE-G-06) : tout ce qui concerne un élève, sous RLS. */
export async function athleteFile(userId: string, wid: string, aid: string, tz: string): Promise<AthleteFileView> {
  const today = todayIn(tz);
  return readAs(userId, async (tx) => {
    const { roster } = await loadRoster(tx, wid, today, tz);
    const entry = roster.find((a) => a.id === aid) ?? null;
    const allTeams = (await tx.query<TeamRef>('select id, name from public.teams where workspace_id = $1 and archived_at is null order by sort_order, name', [wid])).rows;
    const goals = (await tx.query<{ id: string; title: string; sport_code: Sport; target_date: string | null; state: GoalState }>(
      `select id, title, sport_code, to_char(target_date, 'YYYY-MM-DD') as target_date, state from public.goals
       where workspace_id = $1 and athlete_id = $2 order by (state = 'planned') desc, target_date nulls last, created_at desc`,
      [wid, aid],
    )).rows.map((g) => ({ id: g.id, title: g.title, sport: g.sport_code, targetDate: g.target_date, state: g.state }));
    const notes = (await tx.query<{ id: string; body: string; created_at: Date }>(
      'select id, body, created_at from public.coach_notes where workspace_id = $1 and athlete_id = $2 order by created_at desc limit 50',
      [wid, aid],
    )).rows.map((n) => ({ id: n.id, body: n.body, createdAt: new Date(n.created_at).toISOString() }));
    const appointments = (await tx.query<ApptRow>(
      `select ${apptCols} from public.appointments where workspace_id = $1 and athlete_id = $2 and coach_id = auth.uid()
       order by (starts_at >= now()) desc, case when starts_at >= now() then starts_at end asc, starts_at desc limit 20`,
      [wid, aid],
    )).rows.map(toAppt);
    const upcoming = (await tx.query<{ id: string; title: string; local_date: string; published: boolean; sport_code: Sport }>(
      `select w.id, r.title, to_char(r.local_date, 'YYYY-MM-DD') as local_date, (w.published_revision = w.working_revision) as published, r.sport_code
       from public.workouts w join public.workout_revisions r
         on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
       where w.workspace_id = $1 and w.athlete_id = $2 and not r.canceled and r.local_date between $3::date and $4::date
       order by r.local_date, r.sort_order limit 20`,
      [wid, aid, today, addDays(today, 13)],
    )).rows.map((x) => ({ id: x.id, title: x.title, localDate: x.local_date, published: Boolean(x.published), sport: x.sport_code }));
    const recentFeedback = (await tx.query<{ workout_id: string; title: string; local_date: string; state: string; reviewed: boolean }>(
      `select res.workout_id, rev.title, to_char(rev.local_date, 'YYYY-MM-DD') as local_date, res.state, (f.reviewed_at is not null) as reviewed
       from public.workout_results res
       join public.feedbacks f on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
       join public.workout_revisions rev on rev.workspace_id = res.workspace_id and rev.athlete_id = res.athlete_id
            and rev.workout_id = res.workout_id and rev.number = res.workout_revision
       where res.workspace_id = $1 and res.athlete_id = $2 order by rev.local_date desc limit 5`,
      [wid, aid],
    )).rows.map((x) => ({ workoutId: x.workout_id, title: x.title, localDate: x.local_date, state: x.state, reviewed: Boolean(x.reviewed) }));
    const closed = await tx.query<{ n: number }>(
      `select count(*)::int as n from public.coach_tasks where workspace_id = $1 and athlete_id = $2 and status in ('done','canceled')`,
      [wid, aid],
    );
    return { entry, allTeams, goals, notes, appointments, upcoming, recentFeedback, closedTasks: closed.rows[0]?.n ?? 0 };
  });
}

export type { AppointmentKind, AppointmentStatus };
