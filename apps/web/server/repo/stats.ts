import { addDays, comparePeriods, summarize, type GoalState, type LocalDate, type PeriodDelta, type Sport, type StatItem, type StatsSummary } from '@coachos/domain';
import { commandAs } from '../db/client';

// Statistiques d’un élève (D-037) : coach affecté ou élève lui-même. Séances publiées seulement (jamais les brouillons).

export interface NextGoal { title: string; sport: Sport; targetDate: string | null; state: GoalState }

export async function athleteStats(userId: string, wid: string, aid: string, from: LocalDate, to: LocalDate, today: LocalDate): Promise<{ summary: StatsSummary; previous: StatsSummary; delta: PeriodDelta; goal: NextGoal | null } | null> {
  // Période précédente de même durée (D-050), lue dans la même requête.
  const span = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
  const prevFrom = addDays(from, -span), prevTo = addDays(from, -1);
  return commandAs(userId, async (tx) => {
    const ok = await tx.query<{ ok: boolean }>('select (private.assigned($1, $2) or private.own_athlete($1, $2)) as ok', [wid, aid]);
    if (!ok.rows[0]?.ok) return null;
    const rows = await tx.query<{
      local_date: string; canceled: boolean; duration_seconds: number | null; distance_m: number | null;
      state: StatItem['state']; done_seconds: number | null; done_meters: number | null; rpe: number | null; overall_feeling: number | null;
    }>(
      `select to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.canceled, r.duration_seconds, r.distance_m,
              res.state, res.duration_seconds as done_seconds, res.distance_m as done_meters, f.rpe, f.overall_feeling
       from public.workouts w
       join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.published_revision
       left join public.workout_results res on res.workspace_id = w.workspace_id and res.athlete_id = w.athlete_id and res.workout_id = w.id
       left join public.feedbacks f on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
       where w.workspace_id = $1 and w.athlete_id = $2 and w.published_revision is not null and r.local_date between $3::date and $4::date`,
      [wid, aid, prevFrom, to],
    );
    const items: StatItem[] = rows.rows.map((x) => ({
      localDate: x.local_date, canceled: x.canceled, plannedSeconds: x.duration_seconds, plannedMeters: x.distance_m,
      state: x.state, doneSeconds: x.done_seconds, doneMeters: x.done_meters, rpe: x.rpe, feeling: x.overall_feeling,
    }));
    const g = await tx.query<{ title: string; sport_code: Sport; target_date: string | null; state: GoalState }>(
      `select title, sport_code, to_char(target_date, 'YYYY-MM-DD') as target_date, state from public.goals
       where workspace_id = $1 and athlete_id = $2 and state = 'planned'
       order by (target_date is null or target_date < $3::date), target_date, created_at desc limit 1`,
      [wid, aid, today],
    );
    const goal = g.rows[0] ? { title: g.rows[0].title, sport: g.rows[0].sport_code, targetDate: g.rows[0].target_date, state: g.rows[0].state } : null;
    const summary = summarize(items, from, to, today);
    const previous = summarize(items, prevFrom, prevTo, today);
    return { summary, previous, delta: comparePeriods(summary, previous), goal };
  });
}
