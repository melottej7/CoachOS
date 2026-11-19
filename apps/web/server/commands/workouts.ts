import {
  structureTotals,
  createWorkoutSchema,
  parseWith,
  publishSchema,
  updateWorkoutSchema,
  type WorkoutInput,
} from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';

export interface CommandMeta {
  actorId: string;
  workspaceId: string;
  athleteId: string;
  idempotencyKey: string;
  requestId: string;
}

/** Coach actif, affecté au dossier, dossier non archivé. Sinon 404 uniforme. */
export async function requireAssignedCoach(tx: Tx, wid: string, aid: string) {
  const r = await tx.query<{ ok: boolean; state: string | null }>(
    `select private.assigned($1, $2) as ok,
            (select state from public.athletes where workspace_id = $1 and id = $2) as state`,
    [wid, aid],
  );
  const row = r.rows[0];
  if (!row?.ok || row.state === 'archived') throw notVisible();
}

/** `cancellation` : la révision annule la séance, avec ce motif (obligatoire en base). */
export async function insertRevision(tx: Tx, wid: string, aid: string, sid: string, n: number, input: WorkoutInput, cancellation: string | null = null) {
  const t = structureTotals(input.intervals);
  const data = {
    ...input,
    durationSeconds: input.durationSeconds ?? (t.seconds > 0 ? Math.min(86400, t.seconds) : null),
    distanceM: input.distanceM ?? (t.meters > 0 ? Math.min(1_000_000, t.meters) : null),
  };
  await tx.query(
    `insert into public.workout_revisions(workspace_id, athlete_id, workout_id, number, local_date, sort_order, time_zone,
       sport_code, title, instructions, duration_seconds, distance_m, intervals, canceled, cancellation_reason)
     values ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)`,
    [wid, aid, sid, n, data.localDate, data.sortOrder, data.timeZone, data.sport, data.title, data.instructions ?? '',
      data.durationSeconds, data.distanceM, JSON.stringify(data.intervals), cancellation !== null, cancellation],
  );
}

/** createWorkout : parent et première révision dans une transaction. Reste un brouillon (C04-04). */
export async function createWorkout(meta: CommandMeta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(createWorkoutSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { data } = parsed.value;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, meta.workspaceId, meta.athleteId);
    return idempotent(tx, { ...scope(meta, 'workout.create'), body }, async () => {
      const w = await tx.query<{ id: string }>(
        `insert into public.workouts(workspace_id, athlete_id, working_revision) values ($1, $2, 1) returning id`,
        [meta.workspaceId, meta.athleteId],
      );
      const id = w.rows[0]!.id;
      await insertRevision(tx, meta.workspaceId, meta.athleteId, id, 1, data);
      await audit(tx, meta.workspaceId, meta.actorId, 'workout.create', id, meta.requestId);
      return { status: 201, body: { id, workingRevision: 1 } };
    });
  });
}

/**
 * updateWorkout : crée une révision immuable. La version publiée reste celle que lit l’athlète
 * jusqu’à republication volontaire. 409 si la révision attendue est périmée.
 */
export async function updateWorkout(meta: CommandMeta & { workoutId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(updateWorkoutSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { expectedRevision, data } = parsed.value;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, meta.workspaceId, meta.athleteId);
    return idempotent(tx, { ...scope(meta, 'workout.update'), body }, async () => {
      const current = await lockWorkout(tx, meta.workspaceId, meta.athleteId, meta.workoutId);
      if (current.working_revision !== expectedRevision) {
        throw conflict('Cette séance a été modifiée entre-temps. Recharger pour comparer.', {
          workingRevision: current.working_revision,
        });
      }
      const next = current.working_revision + 1;
      await insertRevision(tx, meta.workspaceId, meta.athleteId, meta.workoutId, next, data);
      await tx.query('update public.workouts set working_revision = $4 where workspace_id = $1 and athlete_id = $2 and id = $3', [
        meta.workspaceId, meta.athleteId, meta.workoutId, next,
      ]);
      await audit(tx, meta.workspaceId, meta.actorId, 'workout.update', meta.workoutId, meta.requestId);
      return { status: 200, body: { id: meta.workoutId, workingRevision: next } };
    });
  });
}

async function lockWorkout(tx: Tx, wid: string, aid: string, sid: string) {
  const r = await tx.query<{ working_revision: number; published_revision: number | null }>(
    `select working_revision, published_revision from public.workouts
     where workspace_id = $1 and athlete_id = $2 and id = $3 for update`,
    [wid, aid, sid],
  );
  const row = r.rows[0];
  if (!row) throw notVisible();
  return row;
}

/**
 * publishBatch : 1 à 50 séances d’un dossier, atomique. Chaque ligne doit viser la révision
 * de travail courante, sinon rien n’est publié. Republier la version déjà publiée ne crée
 * pas de doublon (double clic, C05-01).
 */
export async function publishWorkouts(meta: CommandMeta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(publishSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { changes } = parsed.value;
  const ids = changes.map((c) => c.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) throw invalid([{ path: 'changes', rule: 'Une séance apparaît deux fois dans le lot' }]);

  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, meta.workspaceId, meta.athleteId);
    return idempotent(tx, { ...scope(meta, 'workout.publish'), body }, async () => {
      await publishInTx(tx, { workspaceId: meta.workspaceId, athleteId: meta.athleteId, actorId: meta.actorId, requestId: meta.requestId }, changes);
      return { status: 200, body: { items: changes.map((c) => ({ id: c.id, revision: c.revision })) } };
    });
  });
}

/**
 * Publication dans une transaction ouverte (dossier déjà vérifié) : chaque ligne doit viser la révision de travail
 * courante, sinon 409 et rien n’est publié. Partagée par publishBatch et la séance de groupe (D-042).
 */
export async function publishInTx(
  tx: Tx,
  ctx: { workspaceId: string; athleteId: string; actorId: string; requestId: string },
  changes: { id: string; revision: number }[],
  lineOffset = 0,
): Promise<number> {
  const toPublish: { id: string; revision: number }[] = [];
  for (const [i, change] of changes.entries()) {
    const current = await lockWorkout(tx, ctx.workspaceId, ctx.athleteId, change.id).catch(() => null);
    if (!current) throw invalid([{ path: `changes.${i + lineOffset}.id`, rule: 'Séance introuvable dans ce dossier' }]);
    if (current.working_revision !== change.revision) {
      throw conflict('Une séance a changé depuis l’aperçu. Aucune séance n’a été publiée.', {
        line: i + lineOffset,
        id: change.id,
        workingRevision: current.working_revision,
      });
    }
    if (current.published_revision !== change.revision) toPublish.push(change);
  }
  if (!toPublish.length) return 0;
  const pub = await tx.query<{ id: string }>(
    `insert into public.publications(workspace_id, athlete_id, actor_id, kind) values ($1, $2, $3, 'publish') returning id`,
    [ctx.workspaceId, ctx.athleteId, ctx.actorId],
  );
  const publicationId = pub.rows[0]!.id;
  for (const c of toPublish) {
    await tx.query(
      'insert into public.publication_items(workspace_id, athlete_id, publication_id, workout_id, number) values ($1, $2, $3, $4, $5)',
      [ctx.workspaceId, ctx.athleteId, publicationId, c.id, c.revision],
    );
    await tx.query('update public.workouts set published_revision = $4 where workspace_id = $1 and athlete_id = $2 and id = $3', [
      ctx.workspaceId, ctx.athleteId, c.id, c.revision,
    ]);
  }
  await audit(tx, ctx.workspaceId, ctx.actorId, 'workout.publish', publicationId, ctx.requestId);
  return toPublish.length;
}

const scope = (meta: CommandMeta, action: string) => ({
  workspaceId: meta.workspaceId,
  actorId: meta.actorId,
  action,
  key: meta.idempotencyKey,
});
