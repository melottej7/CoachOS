import type { ResultState, Sport } from '@coachos/domain';
import { readAs } from '../db/client';
import { readFeedback, type FeedbackView } from './coach';

// Lectures de l’athlète, sous RLS. L’athlète ne lit pas la table workouts (politique coach seule) :
// il voit les révisions publiées ou observées dans un retour. La version publiée courante est
// la plus haute visible, car le pointeur de publication n’avance jamais vers une version plus ancienne.
// Voir DECISIONS.md, D-006.

export interface AthleteWorkout {
  id: string;
  revision: number;
  localDate: string;
  sortOrder: number;
  sport: Sport;
  title: string;
  instructions: string;
  durationSeconds: number | null;
  distanceM: number | null;
  canceled: boolean;
  feedbackState: ResultState | null;
}

const publishedSql = `
  select x.*, res.state as result_state from (
    select distinct on (r.workout_id) r.workout_id, r.number, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.sort_order,
           r.sport_code, r.title, r.instructions, r.duration_seconds, r.distance_m, r.canceled, r.workspace_id, r.athlete_id
    from public.workout_revisions r
    where r.workspace_id = $1 and r.athlete_id = $2
    order by r.workout_id, r.number desc
  ) x
  left join public.workout_results res on res.workspace_id = x.workspace_id and res.athlete_id = x.athlete_id and res.workout_id = x.workout_id`;

type Row = {
  workout_id: string; number: number; local_date: string; sort_order: number; sport_code: Sport; title: string;
  instructions: string; duration_seconds: number | null; distance_m: number | null; canceled: boolean; result_state: ResultState | null;
};

const toWorkout = (x: Row): AthleteWorkout => ({
  id: x.workout_id,
  revision: x.number,
  localDate: x.local_date,
  sortOrder: x.sort_order,
  sport: x.sport_code,
  title: x.title,
  instructions: x.instructions,
  durationSeconds: x.duration_seconds,
  distanceM: x.distance_m,
  canceled: x.canceled,
  feedbackState: x.result_state,
});

export async function athleteSchedule(userId: string, wid: string, aid: string, from: string, to: string): Promise<AthleteWorkout[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(
      `${publishedSql} where x.local_date::date between $3::date and $4::date order by x.local_date, x.sort_order, x.workout_id`,
      [wid, aid, from, to],
    );
    return r.rows.map(toWorkout);
  });
}

/** Prochaine séance publiée après une date (affichée quand Aujourd’hui est vide). */
export async function nextWorkout(userId: string, wid: string, aid: string, after: string): Promise<AthleteWorkout | null> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(
      `${publishedSql} where x.local_date::date > $3::date and not x.canceled order by x.local_date, x.sort_order limit 1`,
      [wid, aid, after],
    );
    return r.rows[0] ? toWorkout(r.rows[0]) : null;
  });
}

export async function athleteWorkout(
  userId: string,
  wid: string,
  aid: string,
  sid: string,
): Promise<{ workout: AthleteWorkout; feedback: FeedbackView | null } | null> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(`${publishedSql} where x.workout_id = $3`, [wid, aid, sid]);
    const row = r.rows[0];
    if (!row) return null;
    return { workout: toWorkout(row), feedback: await readFeedback(tx, wid, aid, sid) };
  });
}
