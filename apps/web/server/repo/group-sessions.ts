import { followsBase, groupRowState, type GroupSessionRowState, type LibraryWorkout, type Sport } from '@coachos/domain';
import { readAs } from '../db/client';

// Lot G2 (D-042) : lectures de la séance de groupe, sous RLS (coach affecté pour chaque séance).

export interface GroupMember { id: string; name: string; state: 'invited' | 'active'; timeZone: string }
export interface GroupSessionRow {
  athleteId: string; athleteName: string; athleteState: string; workoutId: string;
  workingRevision: number; publishedRevision: number | null; state: GroupSessionRowState;
  title: string; localDate: string; canceled: boolean;
  /** La séance suit encore la base commune (une modification de la base lui sera répercutée). */
  followsBase: boolean;
}
export interface GroupSessionView {
  id: string; teamId: string; teamName: string; title: string; localDate: string; sport: Sport; createdAt: string;
  /** Base commune actuelle et sa révision (D-046). */
  base: LibraryWorkout; revision: number;
  rows: GroupSessionRow[];
  /** Membres actuels du groupe sans séance dans cette base (exclus à la création ou arrivés depuis). */
  without: GroupMember[];
}
export interface GroupSessionSummary { id: string; title: string; localDate: string; total: number; published: number }

/** Membres du groupe que ce coach suit (dossiers non archivés), pour choisir les destinataires. */
export async function teamRecipients(userId: string, wid: string, tid: string): Promise<{ name: string; members: GroupMember[] } | null> {
  return readAs(userId, async (tx) => {
    const t = await tx.query<{ name: string; archived: boolean }>('select name, archived_at is not null as archived from public.teams where workspace_id = $1 and id = $2', [wid, tid]);
    if (!t.rows[0] || t.rows[0].archived) return null;
    const m = await tx.query<{ id: string; display_name: string; state: 'invited' | 'active'; time_zone: string }>(
      `select a.id, a.display_name, a.state, a.time_zone from public.team_athletes ta
       join public.athletes a on a.workspace_id = ta.workspace_id and a.id = ta.athlete_id
       where ta.workspace_id = $1 and ta.team_id = $2 and a.state <> 'archived' and private.assigned(a.workspace_id, a.id)
       order by a.display_name, a.id`,
      [wid, tid],
    );
    return { name: t.rows[0].name, members: m.rows.map((x) => ({ id: x.id, name: x.display_name, state: x.state, timeZone: x.time_zone })) };
  });
}

export async function groupSession(userId: string, wid: string, gid: string): Promise<GroupSessionView | null> {
  return readAs(userId, async (tx) => {
    const g = await tx.query<{ id: string; team_id: string; team_name: string; title: string; local_date: string; base: LibraryWorkout; created_at: Date; revision: number }>(
      `select g.id, g.team_id, t.name as team_name, g.title, to_char(g.local_date, 'YYYY-MM-DD') as local_date, g.base, g.created_at, g.revision
       from public.group_sessions g join public.teams t on t.workspace_id = g.workspace_id and t.id = g.team_id
       where g.workspace_id = $1 and g.id = $2`,
      [wid, gid],
    );
    const s = g.rows[0];
    if (!s) return null;
    const rows = await tx.query<{
      athlete_id: string; display_name: string; state: string; id: string; working_revision: number; published_revision: number | null;
      title: string; local_date: string; canceled: boolean; sport_code: string; instructions: string | null; intervals: unknown;
    }>(
      `select w.athlete_id, a.display_name, a.state, w.id, w.working_revision, w.published_revision, r.title,
              to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.canceled, r.sport_code, r.instructions, r.intervals
       from public.workouts w
       join public.athletes a on a.workspace_id = w.workspace_id and a.id = w.athlete_id
       join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
       where w.workspace_id = $1 and w.group_session_id = $2
       order by a.display_name, a.id`,
      [wid, gid],
    );
    const inSession = new Set(rows.rows.map((r) => r.athlete_id));
    const members = await tx.query<{ id: string; display_name: string; state: 'invited' | 'active'; time_zone: string }>(
      `select a.id, a.display_name, a.state, a.time_zone from public.team_athletes ta
       join public.athletes a on a.workspace_id = ta.workspace_id and a.id = ta.athlete_id
       where ta.workspace_id = $1 and ta.team_id = $2 and a.state <> 'archived' and private.assigned(a.workspace_id, a.id) order by a.display_name`,
      [wid, s.team_id],
    );
    return {
      id: s.id, teamId: s.team_id, teamName: s.team_name, title: s.title, localDate: s.local_date, sport: s.base.sport, createdAt: s.created_at.toISOString(),
      base: s.base, revision: s.revision,
      rows: rows.rows.map((r) => {
        const follows = !r.canceled && followsBase(s.base, { sport: r.sport_code, title: r.title, instructions: r.instructions, intervals: r.intervals, localDate: r.local_date }, s.local_date);
        return {
          athleteId: r.athlete_id, athleteName: r.display_name, athleteState: r.state, workoutId: r.id,
          workingRevision: r.working_revision, publishedRevision: r.published_revision, state: groupRowState(r.working_revision, r.published_revision, follows),
          title: r.title, localDate: r.local_date, canceled: r.canceled, followsBase: follows,
        };
      }),
      without: members.rows.filter((m) => !inSession.has(m.id)).map((m) => ({ id: m.id, name: m.display_name, state: m.state, timeZone: m.time_zone })),
    };
  });
}

/** Séances de groupe récentes et à venir d’un groupe (ou de tous). */
export async function groupSessions(userId: string, wid: string, tid: string | null, from: string): Promise<(GroupSessionSummary & { teamId: string; teamName: string })[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; title: string; local_date: string; team_id: string; team_name: string; total: number; published: number }>(
      `select g.id, g.title, to_char(g.local_date, 'YYYY-MM-DD') as local_date, g.team_id, t.name as team_name,
              count(w.id)::int as total, count(w.id) filter (where w.published_revision = w.working_revision)::int as published
       from public.group_sessions g
       join public.teams t on t.workspace_id = g.workspace_id and t.id = g.team_id
       left join public.workouts w on w.workspace_id = g.workspace_id and w.group_session_id = g.id
       where g.workspace_id = $1 and ($2::uuid is null or g.team_id = $2) and g.local_date >= $3::date
       group by g.workspace_id, g.id, t.workspace_id, t.id order by g.local_date, g.created_at limit 30`,
      [wid, tid, from],
    );
    return r.rows.map((x) => ({ id: x.id, title: x.title, localDate: x.local_date, teamId: x.team_id, teamName: x.team_name, total: x.total, published: x.published }));
  });
}

export interface TeamWeekItem {
  athleteId: string; id: string; localDate: string; title: string; status: 'draft' | 'published' | 'changed';
  canceled: boolean; result: string | null; groupSessionId: string | null;
}

/** CE-G2-03 : semaine d’un groupe, séance par séance et élève par élève (coach affecté seulement). */
export async function teamWeek(userId: string, wid: string, tid: string, from: string, to: string): Promise<{ name: string; members: GroupMember[]; items: TeamWeekItem[] } | null> {
  const team = await teamRecipients(userId, wid, tid);
  if (!team) return null;
  if (!team.members.length) return { ...team, items: [] };
  return readAs(userId, async (tx) => {
    const r = await tx.query<{
      athlete_id: string; id: string; local_date: string; title: string; working_revision: number; published_revision: number | null;
      canceled: boolean; result_state: string | null; group_session_id: string | null;
    }>(
      `select w.athlete_id, w.id, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.title, w.working_revision, w.published_revision,
              r.canceled, res.state as result_state, w.group_session_id
       from public.workouts w
       join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
       left join public.workout_results res on res.workspace_id = w.workspace_id and res.athlete_id = w.athlete_id and res.workout_id = w.id
       where w.workspace_id = $1 and w.athlete_id = any($2::uuid[]) and r.local_date between $3::date and $4::date
       order by r.local_date, r.sort_order, w.created_at`,
      [wid, team.members.map((m) => m.id), from, to],
    );
    return {
      ...team,
      items: r.rows.map((x) => ({
        athleteId: x.athlete_id, id: x.id, localDate: x.local_date, title: x.title,
        status: x.published_revision === null ? 'draft' : x.published_revision === x.working_revision ? 'published' : 'changed',
        canceled: x.canceled, result: x.result_state, groupSessionId: x.group_session_id,
      })),
    };
  });
}
