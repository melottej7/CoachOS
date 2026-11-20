import { workoutStatus, type Block, type Change, type Difficulty, type FeedbackActivity, type Readiness, type ResultState, type Sport, type WorkoutStatus } from '@coachos/domain';
import { readAs, type Tx } from '../db/client';

// Lectures du coach, toutes sous RLS (affectation active obligatoire).

export interface RosterAthlete {
  id: string;
  displayName: string;
  timeZone: string;
  state: 'invited' | 'active' | 'archived';
  openReviews: number;
}

export async function listAssignedAthletes(userId: string, wid: string): Promise<RosterAthlete[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; display_name: string; time_zone: string; state: RosterAthlete['state']; open_reviews: number }>(
      `select a.id, a.display_name, a.time_zone, a.state,
         (select count(*)::int from public.review_items ri
           where ri.workspace_id = a.workspace_id and ri.athlete_id = a.id and ri.state = 'open') as open_reviews
       from public.athletes a
       where a.workspace_id = $1 and a.state <> 'archived'
       order by a.display_name, a.id`,
      [wid],
    );
    return r.rows.map((x) => ({ id: x.id, displayName: x.display_name, timeZone: x.time_zone, state: x.state, openReviews: x.open_reviews }));
  });
}

export interface CoachWorkoutCard {
  id: string;
  localDate: string;
  sortOrder: number;
  sport: Sport;
  title: string;
  durationSeconds: number | null;
  workingRevision: number;
  publishedRevision: number | null;
  status: WorkoutStatus;
  /** Annulée dans la version de travail. */
  canceled: boolean;
  feedback: { state: ResultState; reviewed: boolean } | null;
}

export async function coachWeek(userId: string, wid: string, aid: string, from: string, to: string): Promise<CoachWorkoutCard[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{
      id: string; local_date: string; sort_order: number; sport_code: Sport; title: string; duration_seconds: number | null;
      working_revision: number; published_revision: number | null; result_state: ResultState | null; reviewed_at: Date | null; canceled: boolean;
    }>(
      `select w.id, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.sort_order, r.sport_code, r.title, r.duration_seconds, r.canceled,
              w.working_revision, w.published_revision, res.state as result_state, f.reviewed_at
       from public.workouts w
       join public.workout_revisions r
         on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
       left join public.workout_results res
         on res.workspace_id = w.workspace_id and res.athlete_id = w.athlete_id and res.workout_id = w.id
       left join public.feedbacks f
         on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
       where w.workspace_id = $1 and w.athlete_id = $2 and r.local_date between $3::date and $4::date
       order by r.local_date, r.sort_order, w.created_at, w.id`,
      [wid, aid, from, to],
    );
    return r.rows.map((x) => ({
      id: x.id,
      localDate: x.local_date,
      sortOrder: x.sort_order,
      sport: x.sport_code,
      title: x.title,
      durationSeconds: x.duration_seconds,
      workingRevision: x.working_revision,
      publishedRevision: x.published_revision,
      status: workoutStatus(x.working_revision, x.published_revision),
      canceled: x.canceled,
      feedback: x.result_state ? { state: x.result_state, reviewed: x.reviewed_at !== null } : null,
    }));
  });
}

export interface RevisionView {
  number: number;
  localDate: string;
  timeZone: string;
  sport: Sport;
  title: string;
  instructions: string;
  durationSeconds: number | null;
  distanceM: number | null;
  canceled: boolean;
  intervals: Block[];
}

const revisionColumns = `number, to_char(local_date, 'YYYY-MM-DD') as local_date, time_zone, sport_code, title, instructions,
  duration_seconds, distance_m, canceled, intervals`;

type RevisionRow = {
  number: number; local_date: string; time_zone: string; sport_code: Sport; title: string; instructions: string;
  duration_seconds: number | null; distance_m: number | null; canceled: boolean; intervals: Block[] | null;
};

export const toRevision = (x: RevisionRow): RevisionView => ({
  number: x.number,
  localDate: x.local_date,
  timeZone: x.time_zone,
  sport: x.sport_code,
  title: x.title,
  instructions: x.instructions,
  durationSeconds: x.duration_seconds,
  distanceM: x.distance_m,
  canceled: x.canceled,
  intervals: Array.isArray(x.intervals) ? x.intervals : [],
});

export interface FeedbackView {
  id: string;
  revision: number;
  observedRevision: number;
  state: ResultState;
  durationSeconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  comment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  overallFeeling: number | null;
  /** D-088 : « à 100 % en ce moment ? » ; null = pas répondu. */
  readiness: Readiness | null;
  difficulties: Difficulty[];
  changes: Change[];
  actualSport: Sport | null;
  repeatsDone: number[];
  /** Mesures lues dans un fichier de montre (D-048) ; null = saisies à la main. */
  measureFile: 'fit' | 'tcx' | 'gpx' | null;
  /** Activités de la montre rattachées (CE-X-03, D-064), dans l’ordre de début. */
  activities: FeedbackActivity[];
}

export interface CoachWorkoutDetail {
  id: string;
  athlete: { id: string; displayName: string; timeZone: string };
  status: WorkoutStatus;
  working: RevisionView;
  published: RevisionView | null;
  feedback: FeedbackView | null;
  reviewItemId: string | null;
}

export async function coachWorkout(userId: string, wid: string, aid: string, sid: string): Promise<CoachWorkoutDetail | null> {
  return readAs(userId, async (tx) => {
    const w = await tx.query<{ working_revision: number; published_revision: number | null; display_name: string; time_zone: string }>(
      `select w.working_revision, w.published_revision, a.display_name, a.time_zone
       from public.workouts w join public.athletes a on a.workspace_id = w.workspace_id and a.id = w.athlete_id
       where w.workspace_id = $1 and w.athlete_id = $2 and w.id = $3`,
      [wid, aid, sid],
    );
    const head = w.rows[0];
    if (!head) return null;
    const revs = await tx.query<RevisionRow>(
      `select ${revisionColumns} from public.workout_revisions
       where workspace_id = $1 and athlete_id = $2 and workout_id = $3 and number = any($4::int[])`,
      [wid, aid, sid, [head.working_revision, head.published_revision ?? head.working_revision]],
    );
    const byNumber = new Map(revs.rows.map((x) => [x.number, toRevision(x)]));
    const feedback = await readFeedback(tx, wid, aid, sid);
    const item = feedback
      ? await tx.query<{ id: string }>(
          `select id from public.review_items where workspace_id = $1 and athlete_id = $2 and kind = 'feedback' and source_ref = $3`,
          [wid, aid, feedback.id],
        )
      : null;
    return {
      id: sid,
      athlete: { id: aid, displayName: head.display_name, timeZone: head.time_zone },
      status: workoutStatus(head.working_revision, head.published_revision),
      working: byNumber.get(head.working_revision)!,
      published: head.published_revision === null ? null : byNumber.get(head.published_revision)!,
      feedback,
      reviewItemId: item?.rows[0]?.id ?? null,
    };
  });
}

export async function readFeedback(
  tx: Tx,
  wid: string,
  aid: string,
  sid: string,
): Promise<FeedbackView | null> {
  const r = await tx.query<{
    id: string; revision: number; workout_revision: number; state: ResultState; duration_seconds: number | null;
    distance_m: number | null; rpe: number | null; comment: string | null; reviewed_at: Date | null; created_at: Date;
    overall_feeling: number | null; difficulties: Difficulty[] | null; readiness: Readiness | null;
    changes: Change[] | null; actual_sport: Sport | null; repeats_done: number[] | null; measure_file: 'fit' | 'tcx' | 'gpx' | null;
  }>(
    `select f.id, f.revision, res.workout_revision, res.state, res.duration_seconds, res.distance_m, f.rpe, f.comment,
            f.reviewed_at, f.created_at, f.overall_feeling, f.difficulties, f.changes, f.actual_sport, f.repeats_done, res.measure_file, f.readiness
     from public.workout_results res
     join public.feedbacks f on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
     where res.workspace_id = $1 and res.athlete_id = $2 and res.workout_id = $3`,
    [wid, aid, sid],
  );
  const x = r.rows[0];
  if (!x) return null;
  const acts = await tx.query<{ format: 'fit' | 'tcx' | 'gpx'; sport_code: Sport | null; started_at: Date | null; duration_seconds: number | null; distance_m: number | null }>(
    `select format, sport_code, started_at, duration_seconds, distance_m from public.workout_activities
     where workspace_id = $1 and athlete_id = $2 and workout_id = $3 order by started_at nulls last, created_at`,
    [wid, aid, sid],
  );
  return {
    activities: acts.rows.map((a) => ({ format: a.format, sport: a.sport_code, startedAt: a.started_at ? new Date(a.started_at).toISOString() : null, seconds: a.duration_seconds, distanceM: a.distance_m })),
    id: x.id,
    revision: x.revision,
    observedRevision: x.workout_revision,
    state: x.state,
    durationSeconds: x.duration_seconds,
    distanceM: x.distance_m,
    rpe: x.rpe,
    comment: x.comment,
    reviewedAt: x.reviewed_at?.toISOString() ?? null,
    createdAt: x.created_at.toISOString(),
    overallFeeling: x.overall_feeling,
    readiness: x.readiness,
    difficulties: x.difficulties ?? [],
    changes: x.changes ?? [],
    actualSport: x.actual_sport,
    repeatsDone: (x.repeats_done ?? []).map(Number),
    measureFile: x.measure_file,
  };
}

// ---- File de revue (X10, X11) ----

export interface ReviewRow {
  id: string;
  athleteId: string;
  athleteName: string;
  workoutId: string | null;
  title: string | null;
  localDate: string | null;
  resultState: ResultState | null;
  rpe: number | null;
  hasComment: boolean;
  createdAt: string;
  /** Groupes de l’élève (filtre de la file, C09-08). */
  teamIds: string[];
  /** Reporté jusqu’à cette date (D-082) ; null dans la file active. */
  snoozedUntil: string | null;
  /** D-088 : réponse à « à 100 % en ce moment ? ». */
  readiness: Readiness | null;
}

/** Cas ouverts, triés par rang, échéance puis id (PRD §24). Seuls les retours sans revue (C09-01). */
export async function openReviews(userId: string, wid: string, athleteId?: string, which: 'active' | 'snoozed' = 'active'): Promise<ReviewRow[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{
      id: string; athlete_id: string; display_name: string; workout_id: string | null; title: string | null; local_date: string | null;
      state: ResultState | null; rpe: number | null; has_comment: boolean; created_at: Date; team_ids: string[] | null; snoozed_until: Date | null; readiness: Readiness | null;
    }>(
      `select ri.id, ri.athlete_id, a.display_name, res.workout_id, rev.title, to_char(rev.local_date, 'YYYY-MM-DD') as local_date,
              res.state, f.rpe, (f.comment is not null) as has_comment, ri.created_at, f.readiness,
              (select array_agg(ta.team_id) from public.team_athletes ta where ta.workspace_id = ri.workspace_id and ta.athlete_id = ri.athlete_id) as team_ids,
              case when ri.state = 'snoozed' and ri.due_at > now() then ri.due_at end as snoozed_until
       from public.review_items ri
       join public.athletes a on a.workspace_id = ri.workspace_id and a.id = ri.athlete_id
       left join public.feedbacks f on f.workspace_id = ri.workspace_id and f.athlete_id = ri.athlete_id and f.id = ri.source_ref
       left join public.workout_results res on res.workspace_id = f.workspace_id and res.athlete_id = f.athlete_id and res.id = f.result_id
       left join public.workout_revisions rev on rev.workspace_id = res.workspace_id and rev.athlete_id = res.athlete_id
            and rev.workout_id = res.workout_id and rev.number = res.workout_revision
       where ri.workspace_id = $1 and ri.kind = 'feedback' and f.reviewed_at is null
         and ($2::uuid is null or ri.athlete_id = $2::uuid)
         -- D-082 : un cas reporté revient seul dans la file à sa date.
         and (case when $3 = 'snoozed' then ri.state = 'snoozed' and ri.due_at > now()
                   else ri.state = 'open' or (ri.state = 'snoozed' and ri.due_at <= now()) end)
       order by ri.rank, coalesce(ri.due_at, ri.created_at), ri.id`,
      [wid, athleteId ?? null, which],
    );
    return r.rows.map((x) => ({
      id: x.id,
      athleteId: x.athlete_id,
      athleteName: x.display_name,
      workoutId: x.workout_id,
      title: x.title,
      localDate: x.local_date,
      resultState: x.state,
      rpe: x.rpe,
      hasComment: x.has_comment,
      createdAt: x.created_at.toISOString(),
      teamIds: x.team_ids ?? [],
      snoozedUntil: x.snoozed_until ? x.snoozed_until.toISOString() : null,
      readiness: x.readiness,
    }));
  });
}

export async function openReviewCount(userId: string, wid: string): Promise<number> {
  return (await openReviews(userId, wid)).length;
}

export interface ReviewDetail {
  id: string;
  state: 'open' | 'snoozed' | 'done';
  athleteId: string;
  athleteName: string;
  workoutId: string | null;
  snoozedUntil: string | null;
}

/** Résout un cas vers sa source. null = cas non visible (404 uniforme). */
export async function reviewItem(userId: string, wid: string, rid: string): Promise<ReviewDetail | null> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; state: ReviewDetail['state']; athlete_id: string; display_name: string; workout_id: string | null; due_at: Date | null }>(
      `select ri.id, ri.state, ri.athlete_id, a.display_name, res.workout_id, ri.due_at
       from public.review_items ri
       join public.athletes a on a.workspace_id = ri.workspace_id and a.id = ri.athlete_id
       left join public.feedbacks f on f.workspace_id = ri.workspace_id and f.athlete_id = ri.athlete_id and f.id = ri.source_ref
       left join public.workout_results res on res.workspace_id = f.workspace_id and res.athlete_id = f.athlete_id and res.id = f.result_id
       where ri.workspace_id = $1 and ri.id = $2`,
      [wid, rid],
    );
    const x = r.rows[0];
    return x ? { id: x.id, state: x.state, athleteId: x.athlete_id, athleteName: x.display_name, workoutId: x.workout_id,
      snoozedUntil: x.state === 'snoozed' && x.due_at && x.due_at.getTime() > Date.now() ? x.due_at.toISOString() : null } : null;
  });
}

/** Révision observée par l’athlète au moment du retour (peut différer de la version publiée actuelle). */
export async function revisionByNumber(userId: string, wid: string, aid: string, sid: string, n: number): Promise<RevisionView | null> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<RevisionRow>(
      `select ${revisionColumns} from public.workout_revisions where workspace_id = $1 and athlete_id = $2 and workout_id = $3 and number = $4`,
      [wid, aid, sid, n],
    );
    return r.rows[0] ? toRevision(r.rows[0]) : null;
  });
}
