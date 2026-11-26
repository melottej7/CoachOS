import { activityFingerprint, canGiveFeedback, formatShortDate, markReviewedSchema, parseWith, readinessAlert, saveFeedbackSchema, snoozeError, todayIn, updateReviewSchema, type UpdateReviewInput, type FeedbackActivity } from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { AppError, conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { notify } from './notifications';
import type { CommandMeta } from './workouts';

type Meta = CommandMeta & { workoutId: string; now?: Date };

/**
 * saveFeedback (PUT) : un retour par séance, avec révisions d’édition.
 * La révision observée est celle que l’athlète voit au moment de l’envoi (C06-08).
 * Une correction après revue rouvre le cas : le coach voit ce qui a changé.
 */
export async function saveFeedback(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(saveFeedbackSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const input = parsed.value;
  const { workspaceId: wid, athleteId: aid, workoutId: sid } = meta;

  return commandAs(meta.actorId, async (tx) => {
    const own = await tx.query<{ ok: boolean; time_zone: string | null }>(
      `select private.own_athlete($1, $2) as ok,
              (select time_zone from public.athletes where workspace_id = $1 and id = $2 and state = 'active') as time_zone`,
      [wid, aid],
    );
    if (!own.rows[0]?.ok || !own.rows[0].time_zone) throw notVisible();
    const timeZone = own.rows[0].time_zone;

    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'feedback.save', key: meta.idempotencyKey, body }, async () => {
      const w = await tx.query<{ published_revision: number | null; local_date: string; canceled: boolean }>(
        `select w.published_revision, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.canceled
         from public.workouts w
         join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id
              and r.workout_id = w.id and r.number = w.published_revision
         where w.workspace_id = $1 and w.athlete_id = $2 and w.id = $3
         for update of w`,
        [wid, aid, sid],
      );
      const workout = w.rows[0];
      if (!workout || workout.published_revision === null) throw notVisible(); // brouillon : invisible
      if (workout.published_revision !== input.publishedRevision) {
        throw conflict('Ton coach a mis à jour cette séance. Relis-la avant d’envoyer ton retour.', {
          publishedRevision: workout.published_revision,
        });
      }
      if (!canGiveFeedback(workout.local_date, todayIn(timeZone, meta.now), workout.canceled)) {
        throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Le retour s’ouvre le jour de la séance.');
      }

      const existing = await tx.query<{ result_id: string; feedback_id: string; revision: number; result_revision: number }>(
        `select res.id as result_id, f.id as feedback_id, f.revision, res.revision as result_revision
         from public.workout_results res
         join public.feedbacks f on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
         where res.workspace_id = $1 and res.athlete_id = $2 and res.workout_id = $3
         for update of res, f`,
        [wid, aid, sid],
      );
      const prev = existing.rows[0];
      let feedbackId: string;
      let revision: number;

      if (!prev) {
        if (input.expectedRevision !== null) throw conflict('Ce retour n’existe plus. Recharger la séance.', { revision: null });
        const res = await tx.query<{ id: string }>(
          `insert into public.workout_results(workspace_id, athlete_id, workout_id, workout_revision, state, duration_seconds, distance_m, source, measure_file)
           values ($1, $2, $3, $4, $5, $6, $7, 'manual', $8) returning id`,
          [wid, aid, sid, input.publishedRevision, input.state, input.durationSeconds, input.distanceM, input.measureFile],
        );
        const fb = await tx.query<{ id: string }>(
          `insert into public.feedbacks(workspace_id, athlete_id, result_id, rpe, comment, overall_feeling, difficulties, changes, actual_sport, repeats_done, readiness, readiness_at, test_seconds, strength_log)
           values ($1, $2, $3, $4, $5, $6, $7::text[], $8::text[], $9, $10::smallint[], $11, case when $11::text is null then null else now() end, $12, $13::jsonb) returning id`,
          [wid, aid, res.rows[0]!.id, input.rpe, input.comment, input.overallFeeling, input.difficulties, input.changes, input.actualSport, input.repeatsDone, input.readiness, input.testSeconds, JSON.stringify(input.strengthLog)],
        );
        feedbackId = fb.rows[0]!.id;
        revision = 1;
        await notify(tx, { wid, aid, kind: 'feedback', entityId: sid, to: 'coaches' }); // D-067
      } else {
        // Deux appareils qui corrigent le même retour : le second reçoit un conflit (PRD §21).
        if (input.expectedRevision !== prev.revision) {
          throw conflict('Ce retour a été modifié depuis un autre appareil. Recharger pour voir la dernière version.', {
            revision: prev.revision,
          });
        }
        feedbackId = prev.feedback_id;
        revision = prev.revision + 1;
        await tx.query(
          `update public.workout_results set workout_revision = $4, state = $5, duration_seconds = $6, distance_m = $7, revision = $8, measure_file = $9
           where workspace_id = $1 and athlete_id = $2 and id = $3`,
          [wid, aid, prev.result_id, input.publishedRevision, input.state, input.durationSeconds, input.distanceM, prev.result_revision + 1, input.measureFile],
        );
        await tx.query(
          `update public.feedbacks set rpe = $4, comment = $5, revision = $6, reviewed_at = null, overall_feeling = $7, difficulties = $8::text[],
             changes = $9::text[], actual_sport = $10, repeats_done = $11::smallint[], readiness = $12,
             readiness_at = case when $12::text is null then null when readiness is distinct from $12::text then now() else readiness_at end,
             test_seconds = $13, strength_log = $14::jsonb
           where workspace_id = $1 and athlete_id = $2 and id = $3`,
          [wid, aid, feedbackId, input.rpe, input.comment, revision, input.overallFeeling, input.difficulties, input.changes, input.actualSport, input.repeatsDone, input.readiness, input.testSeconds, JSON.stringify(input.strengthLog)],
        );
      }

      await syncActivities(tx, wid, aid, sid, input.activities);

      // Un seul cas par retour (unique kind + source_ref) ; une correction le rouvre.
      // D-088 : un élève qui n’est pas à 100 % passe en tête de la file (rang 0).
      const rank = readinessAlert(input.readiness) ? 0 : 1;
      await tx.query(
        `insert into public.review_items(workspace_id, athlete_id, kind, state, source_ref, rank)
         values ($1, $2, 'feedback', 'open', $3, $4)
         on conflict (workspace_id, athlete_id, kind, source_ref) do update set state = 'open', due_at = null, rank = excluded.rank`,
        [wid, aid, feedbackId, rank],
      );
      await audit(tx, wid, meta.actorId, prev ? 'feedback.update' : 'feedback.create', feedbackId, meta.requestId);

      return {
        status: 200,
        body: {
          item: {
            id: feedbackId,
            revision,
            observedWorkoutRevision: input.publishedRevision,
            state: input.state,
            durationSeconds: input.durationSeconds,
            distanceM: input.distanceM,
            rpe: input.rpe,
            comment: input.comment,
            overallFeeling: input.overallFeeling,
            readiness: input.readiness,
            testSeconds: input.testSeconds,
            difficulties: input.difficulties,
            changes: input.changes,
            actualSport: input.actualSport,
            repeatsDone: input.repeatsDone,
            strengthLog: input.strengthLog,
            measureFile: input.measureFile,
            activities: input.activities,
          },
        },
      };
    });
  });
}

/**
 * CE-X-03 (D-064) : les activités envoyées remplacent celles de la séance. Une activité déjà rattachée à une autre
 * séance est refusée (aucun double comptage) : l’élève la retire d’abord de cette séance.
 */
async function syncActivities(tx: Tx, wid: string, aid: string, sid: string, list: FeedbackActivity[]) {
  const prints = list.map(activityFingerprint);
  if (prints.length) {
    const elsewhere = await tx.query<{ title: string; local_date: string }>(
      `select r.title, to_char(r.local_date, 'YYYY-MM-DD') as local_date
       from public.workout_activities a
       join public.workouts w on w.workspace_id = a.workspace_id and w.athlete_id = a.athlete_id and w.id = a.workout_id
       join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id
            and r.number = coalesce(w.published_revision, w.working_revision)
       where a.workspace_id = $1 and a.athlete_id = $2 and a.workout_id <> $3 and a.fingerprint = any($4::text[])`,
      [wid, aid, sid, prints],
    );
    const o = elsewhere.rows[0];
    if (o) {
      throw conflict(`Cette activité est déjà rattachée à « ${o.title} » du ${formatShortDate(o.local_date)}. Retire-la d’abord de cette séance pour la déplacer ici.`, {});
    }
  }
  await tx.query('delete from public.workout_activities where workspace_id = $1 and athlete_id = $2 and workout_id = $3 and not (fingerprint = any($4::text[]))', [wid, aid, sid, prints]);
  for (const [i, a] of list.entries()) {
    await tx.query(
      `insert into public.workout_activities(workspace_id, athlete_id, workout_id, format, sport_code, started_at, duration_seconds, distance_m, fingerprint)
       values ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8, $9) on conflict (workspace_id, athlete_id, fingerprint) do nothing`,
      [wid, aid, sid, a.format, a.sport, a.startedAt, a.seconds, a.distanceM, prints[i]],
    );
  }
}

/**
 * markFeedbackReviewed : marque la version courante du retour et clôt le cas lié.
 * Date de revue et acteur enregistrés une seule fois (C06-09) ; acteur dans audit_logs.
 */
export async function markFeedbackReviewed(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(markReviewedSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { workspaceId: wid, athleteId: aid, workoutId: sid } = meta;

  return commandAs(meta.actorId, async (tx: Tx) => {
    const ok = await tx.query<{ ok: boolean }>('select private.assigned($1, $2) as ok', [wid, aid]);
    if (!ok.rows[0]?.ok) throw notVisible();

    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'feedback.review', key: meta.idempotencyKey, body }, async () => {
      const r = await tx.query<{ id: string; revision: number; reviewed_at: Date | null }>(
        `select f.id, f.revision, f.reviewed_at
         from public.workout_results res
         join public.feedbacks f on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
         where res.workspace_id = $1 and res.athlete_id = $2 and res.workout_id = $3
         for update of f`,
        [wid, aid, sid],
      );
      const fb = r.rows[0];
      if (!fb) throw notVisible();
      if (fb.revision !== parsed.value.expectedRevision) {
        throw conflict('L’athlète a corrigé son retour. Relire la nouvelle version avant de la traiter.', { revision: fb.revision });
      }
      if (fb.reviewed_at) return { status: 200, body: { reviewedAt: fb.reviewed_at.toISOString() } };

      const done = await tx.query<{ reviewed_at: Date }>(
        `update public.feedbacks set reviewed_at = now() where workspace_id = $1 and athlete_id = $2 and id = $3
         returning reviewed_at`,
        [wid, aid, fb.id],
      );
      await tx.query(
        `update public.review_items set state = 'done'
         where workspace_id = $1 and athlete_id = $2 and kind = 'feedback' and source_ref = $3`,
        [wid, aid, fb.id],
      );
      await audit(tx, wid, meta.actorId, 'feedback.reviewed', fb.id, meta.requestId);
      return { status: 200, body: { reviewedAt: done.rows[0]!.reviewed_at.toISOString() } };
    });
  });
}

/**
 * reopenFeedbackReview (bilan produit) · « Annuler » juste après un traitement : le retour revient dans la file, tel quel.
 * Mêmes droits que le traitement (coach affecté à l’élève). Sans effet sur un retour déjà ouvert.
 */
export async function reopenFeedbackReview(meta: Meta): Promise<StoredResponse> {
  const { workspaceId: wid, athleteId: aid, workoutId: sid } = meta;
  return commandAs(meta.actorId, async (tx: Tx) => {
    const ok = await tx.query<{ ok: boolean }>('select private.assigned($1, $2) as ok', [wid, aid]);
    if (!ok.rows[0]?.ok) throw notVisible();
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'feedback.reopen', key: meta.idempotencyKey, body: {} }, async () => {
      const r = await tx.query<{ id: string; reviewed_at: Date | null }>(
        `select f.id, f.reviewed_at
         from public.workout_results res
         join public.feedbacks f on f.workspace_id = res.workspace_id and f.athlete_id = res.athlete_id and f.result_id = res.id
         where res.workspace_id = $1 and res.athlete_id = $2 and res.workout_id = $3
         for update of f`,
        [wid, aid, sid],
      );
      const fb = r.rows[0];
      if (!fb) throw notVisible();
      if (!fb.reviewed_at) return { status: 200, body: { reopened: false } };
      await tx.query('update public.feedbacks set reviewed_at = null where workspace_id = $1 and athlete_id = $2 and id = $3', [wid, aid, fb.id]);
      await tx.query(
        `update public.review_items set state = 'open', due_at = null
         where workspace_id = $1 and athlete_id = $2 and kind = 'feedback' and source_ref = $3`,
        [wid, aid, fb.id],
      );
      await audit(tx, wid, meta.actorId, 'feedback.reopened', fb.id, meta.requestId);
      return { status: 200, body: { reopened: true } };
    });
  });
}

/**
 * updateReview · C : reporter un retour à une date future (il revient seul dans la file) ou le remettre tout de suite
 * (D-082, § 24 du PRD). Clore passe par markFeedbackReviewed, qui vérifie la version lue.
 */
export async function updateReview(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; reviewId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(updateReviewSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const v = parsed.value as UpdateReviewInput;
  const wid = meta.workspaceId;
  if (v.state === 'snoozed') {
    const err = snoozeError(new Date(v.snoozeUntil!), new Date());
    if (err) throw invalid([{ path: 'snoozeUntil', rule: err }]);
  }
  return commandAs(meta.actorId, async (tx: Tx) => {
    const it = await tx.query<{ athlete_id: string; state: string; reviewed: boolean }>(
      `select ri.athlete_id, ri.state, (f.reviewed_at is not null) as reviewed from public.review_items ri
       left join public.feedbacks f on f.workspace_id = ri.workspace_id and f.athlete_id = ri.athlete_id and f.id = ri.source_ref
       where ri.workspace_id = $1 and ri.id = $2 and ri.kind = 'feedback' for update of ri`,
      [wid, meta.reviewId],
    );
    const row = it.rows[0];
    if (!row) throw notVisible();
    const ok = await tx.query<{ ok: boolean }>('select private.assigned($1, $2) as ok', [wid, row.athlete_id]);
    if (!ok.rows[0]?.ok) throw notVisible();
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'review.update', key: meta.idempotencyKey, body: { id: meta.reviewId, ...v } }, async () => {
      if (row.state === 'done' || row.reviewed) throw conflict('Ce retour est déjà traité.', {});
      const r = await tx.query<{ id: string; athlete_id: string; kind: string; rank: number; state: string; due_at: Date | null }>(
        `update public.review_items set state = $3, due_at = $4 where workspace_id = $1 and id = $2 returning id, athlete_id, kind, rank, state, due_at`,
        [wid, meta.reviewId, v.state, v.state === 'snoozed' ? v.snoozeUntil : null],
      );
      await audit(tx, wid, meta.actorId, v.state === 'snoozed' ? 'review.snooze' : 'review.reopen', meta.reviewId, meta.requestId);
      const x = r.rows[0]!;
      return { status: 200, body: { item: { id: x.id, athleteId: x.athlete_id, kind: x.kind, rank: x.rank, state: x.state, dueAt: x.due_at ? x.due_at.toISOString() : null } } };
    });
  });
}
