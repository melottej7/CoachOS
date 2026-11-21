import { detectVideoType, EXERCISE_CLIP_MAX_BYTES, exerciseInputSchema, parseWith, STARTER_EXERCISES, starterKey, type ExerciseInput } from '@coachos/domain';
import { z } from 'zod';
import { commandAs, type Tx } from '../db/client';
import { conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireCoach } from './portfolio';

// D-096 · Bibliothèque d’exercices de musculation : écriture par le coach de l’espace, lecture par ses élèves.

interface Meta { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }

const parse = <T>(schema: Parameters<typeof parseWith>[0], body: unknown): T => {
  const p = parseWith(schema, body);
  if (!p.ok) throw invalid(p.fields);
  return p.value as T;
};

const updateSchema = exerciseInputSchema.extend({
  expectedRevision: z.number().int().min(1),
  archive: z.boolean().optional(),
}).strict();

async function nameTaken(tx: Tx, wid: string, name: string, except: string | null): Promise<boolean> {
  const r = await tx.query('select 1 from public.exercises where workspace_id = $1 and lower(name) = lower($2) and not archived and ($3::uuid is null or id <> $3)', [wid, name, except]);
  return r.rows.length > 0;
}

/** createExercise · C : nouvel exercice (nom unique dans l’espace, parmi les exercices actifs). */
export async function createExercise(meta: Meta, body: unknown): Promise<StoredResponse> {
  const v = parse<ExerciseInput>(exerciseInputSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'exercise.create', key: meta.idempotencyKey, body: v }, async () => {
      if (await nameTaken(tx, wid, v.name, null)) throw invalid([{ path: 'name', rule: 'Un exercice porte déjà ce nom' }]);
      const r = await tx.query<{ id: string; revision: number }>(
        `insert into public.exercises(workspace_id, owner_id, name, instructions, muscle, equipment, video_url, use_base_video)
         values ($1, auth.uid(), $2, $3, $4, $5, $6, $7) returning id, revision`,
        [wid, v.name, v.instructions, v.muscle, v.equipment, v.videoUrl, v.useBaseVideo],
      );
      const x = r.rows[0]!;
      await audit(tx, wid, meta.actorId, 'exercise.create', x.id, meta.requestId);
      return { status: 201, body: { id: x.id, revision: x.revision } };
    });
  });
}

/** updateExercise · C : modifier ou retirer (archiver) un exercice ; les séances déjà écrites gardent leur copie du nom. */
export async function updateExercise(meta: Meta & { exerciseId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<ExerciseInput & { expectedRevision: number; archive?: boolean }>(updateSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'exercise.update', key: meta.idempotencyKey, body: { id: meta.exerciseId, ...v } }, async () => {
      const cur = await tx.query<{ revision: number }>('select revision from public.exercises where workspace_id = $1 and id = $2 for update', [wid, meta.exerciseId]);
      if (!cur.rows[0]) throw notVisible();
      if (cur.rows[0].revision !== v.expectedRevision) throw conflict('Cet exercice a été modifié entre-temps. Recharge la page.', { currentRevision: cur.rows[0].revision });
      if (!v.archive && await nameTaken(tx, wid, v.name, meta.exerciseId)) throw invalid([{ path: 'name', rule: 'Un exercice porte déjà ce nom' }]);
      const r = await tx.query<{ revision: number }>(
        `update public.exercises set name = $3, instructions = $4, muscle = $5, equipment = $6, video_url = $7,
           archived = coalesce($8, archived), use_base_video = $9, revision = revision + 1
         where workspace_id = $1 and id = $2 returning revision`,
        [wid, meta.exerciseId, v.name, v.instructions, v.muscle, v.equipment, v.videoUrl, v.archive ?? null, v.useBaseVideo],
      );
      await audit(tx, wid, meta.actorId, v.archive ? 'exercise.archive' : 'exercise.update', meta.exerciseId, meta.requestId);
      return { status: 200, body: { id: meta.exerciseId, revision: r.rows[0]!.revision } };
    });
  });
}

/** addStarterExercises · C : exercices de départ, sans doublon de nom ; rejouer n’ajoute que les manquants. */
export async function addStarterExercises(meta: Meta): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'exercise.starter', key: meta.idempotencyKey, body: {} }, async () => {
      const have = new Set((await tx.query<{ n: string }>('select lower(name) as n from public.exercises where workspace_id = $1 and not archived', [wid])).rows.map((r) => r.n));
      let added = 0;
      for (const [name, muscle, equipment, instructions] of STARTER_EXERCISES) {
        if (have.has(name.toLowerCase())) continue;
        await tx.query(
          `insert into public.exercises(workspace_id, owner_id, name, instructions, muscle, equipment, starter, starter_key) values ($1, auth.uid(), $2, $3, $4, $5, true, $6)`,
          [wid, name, instructions, muscle, equipment, starterKey(name)],
        );
        added++;
      }
      await audit(tx, wid, meta.actorId, 'exercise.starter', wid, meta.requestId);
      return { status: 200, body: { added, skipped: STARTER_EXERCISES.length - added } };
    });
  });
}

/** uploadExerciseClip · C : vidéo filmée par le coach (mp4, mov ou webm, 25 Mio au plus), remplace la précédente. */
export async function uploadExerciseClip(meta: { actorId: string; requestId: string; workspaceId: string; exerciseId: string }, bytes: Uint8Array): Promise<StoredResponse> {
  if (!bytes.length) throw invalid([{ path: 'video', rule: 'Fichier vide' }]);
  if (bytes.length > EXERCISE_CLIP_MAX_BYTES) throw invalid([{ path: 'video', rule: 'Vidéo trop lourde (25 Mio au plus)' }]);
  const type = detectVideoType(bytes);
  if (!type) throw invalid([{ path: 'video', rule: 'Format non reconnu : MP4, MOV ou WebM' }]);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    const cur = await tx.query<{ clip_id: string | null }>('select clip_id from public.exercises where workspace_id = $1 and id = $2 for update', [wid, meta.exerciseId]);
    if (!cur.rows[0]) throw notVisible();
    const c = await tx.query<{ id: string }>(
      'insert into public.exercise_clips(workspace_id, owner_id, content_type, bytes) values ($1, auth.uid(), $2, $3) returning id',
      [wid, type, Buffer.from(bytes)],
    );
    const r = await tx.query<{ revision: number }>(
      'update public.exercises set clip_id = $3, revision = revision + 1 where workspace_id = $1 and id = $2 returning revision',
      [wid, meta.exerciseId, c.rows[0]!.id],
    );
    if (cur.rows[0].clip_id) await tx.query('delete from public.exercise_clips where workspace_id = $1 and id = $2', [wid, cur.rows[0].clip_id]);
    await audit(tx, wid, meta.actorId, 'exercise.clip', meta.exerciseId, meta.requestId);
    return { status: 200, body: { id: meta.exerciseId, clipId: c.rows[0]!.id, revision: r.rows[0]!.revision } };
  });
}

/** removeExerciseClip · C : retirer la vidéo filmée (le lien éventuel reste). */
export async function removeExerciseClip(meta: Meta & { exerciseId: string }): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'exercise.clip.remove', key: meta.idempotencyKey, body: { id: meta.exerciseId } }, async () => {
      const cur = await tx.query<{ clip_id: string | null }>('select clip_id from public.exercises where workspace_id = $1 and id = $2 for update', [wid, meta.exerciseId]);
      if (!cur.rows[0]) throw notVisible();
      const r = await tx.query<{ revision: number }>('update public.exercises set clip_id = null, revision = revision + 1 where workspace_id = $1 and id = $2 returning revision', [wid, meta.exerciseId]);
      if (cur.rows[0].clip_id) await tx.query('delete from public.exercise_clips where workspace_id = $1 and id = $2', [wid, cur.rows[0].clip_id]);
      await audit(tx, wid, meta.actorId, 'exercise.clip.remove', meta.exerciseId, meta.requestId);
      return { status: 200, body: { id: meta.exerciseId, revision: r.rows[0]!.revision } };
    });
  });
}
