import { addDays, utcToLocal, weekReview, type Difficulty, type MeasureFacts, type Readiness, type ReviewSession, type WeekReview } from '@coachos/domain';
import { readAs } from '../db/client';

/**
 * Résumé de la semaine d’un élève (D-073), calculé sur les séances publiées et les retours déclarés.
 * Lecture sous RLS, coach affecté seulement (l’élève lit ses séances par un autre chemin, filtré). Aucun texte libre
 * (commentaire, message) n’est repris.
 */
export async function athleteWeekReview(userId: string, wid: string, aid: string, monday: string, today: string): Promise<WeekReview | null> {
  return readAs(userId, async (tx) => {
    const ok = await tx.query<{ ok: boolean }>('select private.assigned($1, $2) as ok', [wid, aid]);
    if (!ok.rows[0]?.ok) return null;
    const r = await tx.query<{
      local_date: string; title: string; canceled: boolean; duration_seconds: number | null; state: ReviewSession['state'];
      done_seconds: number | null; rpe: number | null; overall_feeling: number | null; difficulties: Difficulty[] | null; readiness: Readiness | null;
    }>(
      `select to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.title, r.canceled, r.duration_seconds,
              res.state, res.duration_seconds as done_seconds, f.rpe, f.overall_feeling, f.difficulties, f.readiness
       from public.workouts w
       join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.published_revision
       left join public.workout_results res on res.workspace_id = w.workspace_id and res.athlete_id = w.athlete_id and res.workout_id = w.id
       left join public.feedbacks f on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
       where w.workspace_id = $1 and w.athlete_id = $2 and w.published_revision is not null
         and r.local_date between $3::date and ($3::date + 6)
       order by r.local_date, r.sort_order`,
      [wid, aid, monday],
    );
    return weekReview(r.rows.map((x) => ({
      date: x.local_date, title: x.title, canceled: x.canceled, plannedSeconds: x.duration_seconds, state: x.state ?? null,
      doneSeconds: x.done_seconds, rpe: x.rpe, feeling: x.overall_feeling, difficulties: x.difficulties ?? [], readiness: x.readiness,
    })), monday, today);
  });
}

/** D-075 : source et fraîcheur des mesures de l’élève sur 30 jours (coach affecté seulement). */
export async function athleteMeasureFacts(userId: string, wid: string, aid: string, today: string, timeZone: string, windowDays = 30): Promise<MeasureFacts | null> {
  return readAs(userId, async (tx) => {
    const ok = await tx.query<{ ok: boolean }>('select private.assigned($1, $2) as ok', [wid, aid]);
    if (!ok.rows[0]?.ok) return null;
    const from = addDays(today, -windowDays);
    const a = await tx.query<{ started_at: Date | null; format: 'fit' | 'tcx' | 'gpx'; recent: boolean }>(
      `select started_at, format, (coalesce(started_at, created_at) >= $3::date) as recent from public.workout_activities
       where workspace_id = $1 and athlete_id = $2 order by started_at desc nulls last, created_at desc`,
      [wid, aid, from],
    );
    const r = await tx.query<{ n: number; watch: number; last: string | null }>(
      `select count(*)::int as n, count(*) filter (where res.measure_file is not null)::int as watch, to_char(max(rv.local_date), 'YYYY-MM-DD') as last
       from public.workout_results res
       join public.workout_revisions rv on rv.workspace_id = res.workspace_id and rv.athlete_id = res.athlete_id and rv.workout_id = res.workout_id and rv.number = res.workout_revision
       where res.workspace_id = $1 and res.athlete_id = $2 and rv.local_date >= $3::date and res.state in ('completed', 'partial')`,
      [wid, aid, from],
    );
    const first = a.rows[0];
    return {
      windowDays,
      lastActivity: first?.started_at ? { date: utcToLocal(new Date(first.started_at), timeZone).date, format: first.format } : null,
      activities: a.rows.filter((x) => x.recent).length,
      feedbacks: r.rows[0]?.n ?? 0, fromWatch: r.rows[0]?.watch ?? 0, lastFeedback: r.rows[0]?.last ?? null,
    };
  });
}

