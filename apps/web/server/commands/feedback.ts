import { canGiveFeedback, markReviewedSchema, parseWith, saveFeedbackSchema, todayIn } from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { AppError, conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
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
          `insert into public.workout_results(workspace_id, athlete_id, workout_id, workout_revision, state, duration_seconds, distance_m, source)
           values ($1, $2, $3, $4, $5, $6, $7, 'manual') returning id`,
          [wid, aid, sid, input.publishedRevision, input.state, input.durationSeconds, input.distanceM],
        );
        const fb = await tx.query<{ id: string }>(
          `insert into public.feedbacks(workspace_id, athlete_id, result_id, rpe, comment) values ($1, $2, $3, $4, $5) returning id`,
          [wid, aid, res.rows[0]!.id, input.rpe, input.comment],
        );
        feedbackId = fb.rows[0]!.id;
        revision = 1;
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
          `update public.workout_results set workout_revision = $4, state = $5, duration_seconds = $6, distance_m = $7, revision = $8
           where workspace_id = $1 and athlete_id = $2 and id = $3`,
          [wid, aid, prev.result_id, input.publishedRevision, input.state, input.durationSeconds, input.distanceM, prev.result_revision + 1],
        );
        await tx.query(
          `update public.feedbacks set rpe = $4, comment = $5, revision = $6, reviewed_at = null
           where workspace_id = $1 and athlete_id = $2 and id = $3`,
          [wid, aid, feedbackId, input.rpe, input.comment, revision],
        );
      }

      // Un seul cas par retour (unique kind + source_ref) ; une correction le rouvre.
      await tx.query(
        `insert into public.review_items(workspace_id, athlete_id, kind, state, source_ref, rank)
         values ($1, $2, 'feedback', 'open', $3, 1)
         on conflict (workspace_id, athlete_id, kind, source_ref) do update set state = 'open'`,
        [wid, aid, feedbackId],
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
          },
        },
      };
    });
  });
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
