import { copyWorkoutSchema, moveWorkoutSchema, parseWith, revisionOnlySchema, type Block, type Sport, type WorkoutInput } from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { insertRevision, requireAssignedCoach, type CommandMeta } from './workouts';

/**
 * D-158 · Gestes du calendrier : déplacer, copier, retirer un brouillon, le rétablir. Chaque geste crée une révision
 * (les révisions sont immuables) ou une nouvelle séance en brouillon ; rien n’est publié, rien n’est effacé. L’annulation
 * des 10 secondes, côté écran, est le geste inverse : déplacer à l’ancienne date, retirer la copie, rétablir le brouillon.
 */

type Meta = CommandMeta & { workoutId: string };

interface WorkingRow {
  working_revision: number; published_revision: number | null; local_date: string; sort_order: number; time_zone: string; sport_code: Sport;
  title: string; instructions: string | null; duration_seconds: number | null; distance_m: number | null; intervals: Block[]; canceled: boolean; has_result: boolean;
}

/** Révision de travail de la séance, verrouillée ; 404 uniforme si elle n’existe pas dans ce dossier. */
async function readWorking(tx: Tx, wid: string, aid: string, sid: string, number?: 'previous'): Promise<WorkingRow> {
  const r = await tx.query<WorkingRow>(
    `select w.working_revision, w.published_revision, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.sort_order, r.time_zone,
            r.sport_code, r.title, r.instructions, r.duration_seconds, r.distance_m, r.intervals, r.canceled,
            exists (select 1 from public.workout_results x where x.workspace_id = w.workspace_id and x.athlete_id = w.athlete_id and x.workout_id = w.id) as has_result
       from public.workouts w
       join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id
        and r.number = ${number === 'previous' ? 'w.working_revision - 1' : 'w.working_revision'}
      where w.workspace_id = $1 and w.athlete_id = $2 and w.id = $3
        for update of w`,
    [wid, aid, sid],
  );
  const row = r.rows[0];
  if (!row) throw notVisible();
  return row;
}

const toInput = (r: WorkingRow, patch: Partial<WorkoutInput> = {}): WorkoutInput => ({
  localDate: r.local_date, timeZone: r.time_zone, sortOrder: r.sort_order, sport: r.sport_code, title: r.title,
  instructions: r.instructions || null, durationSeconds: r.duration_seconds, distanceM: r.distance_m,
  intervals: (Array.isArray(r.intervals) ? r.intervals : []) as WorkoutInput['intervals'], ...patch,
});

function expectRevision(row: WorkingRow, expected: number) {
  if (row.working_revision !== expected) {
    throw conflict('Cette séance a été modifiée entre-temps. Recharger pour comparer.', { workingRevision: row.working_revision });
  }
}

async function nextRevision(tx: Tx, m: Meta, row: WorkingRow, input: WorkoutInput, cancellation: string | null = null) {
  const next = row.working_revision + 1;
  await insertRevision(tx, m.workspaceId, m.athleteId, m.workoutId, next, input, cancellation);
  await tx.query('update public.workouts set working_revision = $4 where workspace_id = $1 and athlete_id = $2 and id = $3', [m.workspaceId, m.athleteId, m.workoutId, next]);
  return next;
}

const scope = (m: CommandMeta, action: string, body: unknown) => ({ workspaceId: m.workspaceId, actorId: m.actorId, action, key: m.idempotencyKey, body });

/** moveWorkout · C : même contenu, autre date. Publiée : l’élève garde l’ancienne date jusqu’à la republication. */
export async function moveWorkout(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(moveWorkoutSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { expectedRevision, localDate } = parsed.value;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, meta.workspaceId, meta.athleteId);
    return idempotent(tx, scope(meta, 'workout.move', body), async () => {
      const row = await readWorking(tx, meta.workspaceId, meta.athleteId, meta.workoutId);
      expectRevision(row, expectedRevision);
      if (row.canceled) throw conflict('Cette séance est annulée : elle ne se déplace pas.');
      if (row.has_result) throw conflict('Cette séance a déjà un retour de l’élève : elle reste à sa date.');
      if (row.local_date === localDate) throw invalid([{ path: 'localDate', rule: 'La séance est déjà à cette date' }]);
      const next = await nextRevision(tx, meta, row, toInput(row, { localDate }));
      await audit(tx, meta.workspaceId, meta.actorId, 'workout.move', meta.workoutId, meta.requestId);
      return { status: 200, body: { id: meta.workoutId, workingRevision: next, previousDate: row.local_date, published: row.published_revision !== null } };
    });
  });
}

/** copyWorkout · C : nouvelle séance en brouillon, même contenu, pour cet élève ou un autre élève suivi par le coach. */
export async function copyWorkout(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(copyWorkoutSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { localDate } = parsed.value;
  const target = parsed.value.athleteId ?? meta.athleteId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, meta.workspaceId, meta.athleteId);
    if (target !== meta.athleteId) await requireAssignedCoach(tx, meta.workspaceId, target);
    return idempotent(tx, scope(meta, 'workout.copy', body), async () => {
      const row = await readWorking(tx, meta.workspaceId, meta.athleteId, meta.workoutId);
      if (row.canceled) throw conflict('Cette séance est annulée : rien à copier.');
      const a = await tx.query<{ time_zone: string }>('select time_zone from public.athletes where workspace_id = $1 and id = $2', [meta.workspaceId, target]);
      if (!a.rows[0]) throw notVisible();
      const w = await tx.query<{ id: string }>(
        'insert into public.workouts(workspace_id, athlete_id, working_revision) values ($1, $2, 1) returning id',
        [meta.workspaceId, target],
      );
      const id = w.rows[0]!.id;
      await insertRevision(tx, meta.workspaceId, target, id, 1, toInput(row, { localDate, timeZone: a.rows[0].time_zone }));
      await audit(tx, meta.workspaceId, meta.actorId, 'workout.copy', id, meta.requestId);
      return { status: 201, body: { id, athleteId: target, workingRevision: 1 } };
    });
  });
}

/** discardWorkout · C : retire un brouillon jamais publié (révision d’annulation ; il disparaît du calendrier). */
export async function discardWorkout(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(revisionOnlySchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, meta.workspaceId, meta.athleteId);
    return idempotent(tx, scope(meta, 'workout.discard', body), async () => {
      const row = await readWorking(tx, meta.workspaceId, meta.athleteId, meta.workoutId);
      expectRevision(row, parsed.value.expectedRevision);
      if (row.published_revision !== null) throw conflict('Cette séance a été publiée : elle ne se retire pas d’ici. Ouvre-la pour l’annuler.');
      if (row.canceled) throw conflict('Ce brouillon est déjà retiré.');
      const next = await nextRevision(tx, meta, row, toInput(row), 'Brouillon retiré par le coach');
      await audit(tx, meta.workspaceId, meta.actorId, 'workout.discard', meta.workoutId, meta.requestId);
      return { status: 200, body: { id: meta.workoutId, workingRevision: next } };
    });
  });
}

/** restoreWorkout · C : rétablit un brouillon retiré (son contenu d’avant le retrait). */
export async function restoreWorkout(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(revisionOnlySchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, meta.workspaceId, meta.athleteId);
    return idempotent(tx, scope(meta, 'workout.restore', body), async () => {
      const row = await readWorking(tx, meta.workspaceId, meta.athleteId, meta.workoutId);
      expectRevision(row, parsed.value.expectedRevision);
      if (!row.canceled || row.published_revision !== null || row.working_revision < 2) throw conflict('Ce brouillon n’est pas retiré.');
      const before = await readWorking(tx, meta.workspaceId, meta.athleteId, meta.workoutId, 'previous');
      const next = await nextRevision(tx, meta, row, toInput(before));
      await audit(tx, meta.workspaceId, meta.actorId, 'workout.restore', meta.workoutId, meta.requestId);
      return { status: 200, body: { id: meta.workoutId, workingRevision: next } };
    });
  });
}
