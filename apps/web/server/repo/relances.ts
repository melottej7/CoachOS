import { adherenceOf, ADHERENCE_RANK, relanceDraft, todayIn, type Adherence, type Readiness, type RecentSession } from '@coachos/domain';
import { commandAs } from '../db/client';

// D-103 · Statut d’adhésion et relance proposée, pour chaque élève actif suivi par le coach connecté.

export interface RelanceRow extends Adherence { athleteId: string; name: string; first: string; draft: string | null }

export async function relances(userId: string, wid: string): Promise<RelanceRow[]> {
  return commandAs(userId, async (tx) => {
    const r = await tx.query<{
      id: string; display_name: string; time_zone: string; recent: RecentSession[] | null; last_feedback: string | null;
      last_athlete_msg: string | null; last_coach_msg: string | null; readiness: Readiness | null; readiness_on: string | null; upcoming7: number;
    }>(
      `select a.id, a.display_name, a.time_zone,
         (select json_agg(json_build_object('id', w.id, 'date', to_char(rv.local_date, 'YYYY-MM-DD'), 'title', rv.title, 'state', res.state) order by rv.local_date)
            from public.workouts w
            join public.workout_revisions rv on rv.workspace_id = w.workspace_id and rv.athlete_id = w.athlete_id and rv.workout_id = w.id and rv.number = w.published_revision
            left join public.workout_results res on res.workspace_id = w.workspace_id and res.athlete_id = w.athlete_id and res.workout_id = w.id
            where w.workspace_id = a.workspace_id and w.athlete_id = a.id and w.published_revision is not null and not rv.canceled
              and rv.local_date >= (now() at time zone a.time_zone)::date - 14 and rv.local_date < (now() at time zone a.time_zone)::date) as recent,
         (select to_char(max(f.created_at) at time zone a.time_zone, 'YYYY-MM-DD') from public.feedbacks f where f.workspace_id = a.workspace_id and f.athlete_id = a.id) as last_feedback,
         (select to_char(max(m.created_at) at time zone a.time_zone, 'YYYY-MM-DD') from public.messages m
            where m.workspace_id = a.workspace_id and m.athlete_id = a.id and m.sender_id = a.user_id) as last_athlete_msg,
         (select to_char(max(m.created_at) at time zone a.time_zone, 'YYYY-MM-DD') from public.messages m
            where m.workspace_id = a.workspace_id and m.athlete_id = a.id and m.sender_id is distinct from a.user_id) as last_coach_msg,
         rd.readiness, to_char(rd.readiness_at at time zone a.time_zone, 'YYYY-MM-DD') as readiness_on,
         (select count(*)::int from public.workouts w
            join public.workout_revisions rv on rv.workspace_id = w.workspace_id and rv.athlete_id = w.athlete_id and rv.workout_id = w.id and rv.number = w.published_revision
            where w.workspace_id = a.workspace_id and w.athlete_id = a.id and w.published_revision is not null and not rv.canceled
              and rv.local_date between (now() at time zone a.time_zone)::date and (now() at time zone a.time_zone)::date + 6) as upcoming7
       from public.athletes a
       left join lateral (
         select f.readiness, f.readiness_at from public.feedbacks f
         where f.workspace_id = a.workspace_id and f.athlete_id = a.id and f.readiness is not null
         order by f.readiness_at desc nulls last limit 1
       ) rd on true
       where a.workspace_id = $1 and a.state = 'active' and private.assigned($1, a.id)
       order by a.display_name`,
      [wid],
    );
    return r.rows
      .map((x): RelanceRow => {
        const first = x.display_name.split(' ')[0] ?? x.display_name;
        const a = adherenceOf({
          today: todayIn(x.time_zone), recent: x.recent ?? [], lastFeedbackOn: x.last_feedback, lastAthleteMessageOn: x.last_athlete_msg,
          lastCoachMessageOn: x.last_coach_msg, readiness: x.readiness && x.readiness_on ? { value: x.readiness, on: x.readiness_on } : null, upcoming7: x.upcoming7,
        });
        return { ...a, athleteId: x.id, name: x.display_name, first, draft: a.relance ? relanceDraft(a.relance, { first, workout: a.workout, silentDays: a.silentDays, done7: a.done7, due7: a.due7 }) : null };
      })
      .sort((p, q) => ADHERENCE_RANK[p.status] - ADHERENCE_RANK[q.status] || (q.silentDays ?? 0) - (p.silentDays ?? 0) || p.name.localeCompare(q.name, 'fr'));
  });
}
