import { randomUUID } from 'node:crypto';
import {
  detectVideoType, EXERCISE_CLIP_MAX_BYTES, EXERCISE_CLIP_STORAGE_MAX_BYTES, EXERCISE_CLIP_TYPES, exerciseInputSchema, machineExercise, machineInstructions, parseWith,
  STARTER_EXERCISES, starterKey, type ExerciseInput, type MachineExercise,
} from '@coachos/domain';
import { z } from 'zod';
import { commandAs, type Tx } from '../db/client';
import { AppError, conflict, invalid, notVisible } from '../errors';
import { clipObjectPath, videoStore, type VideoStore } from '../storage/video-store';
import { reportError } from '../error-report';
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

const machineSchema = z.object({ keys: z.array(z.string().max(80)).min(1, { message: 'Choisis au moins un exercice' }).max(80) }).strict();

/**
 * addMachineExercises · C (D-178) : exercices de la bibliothèque des machines ajoutés à celle du coach, avec leurs
 * réglages et consignes, sans doublon de nom. La clé du catalogue est gardée : l’animation suit, une fois validée.
 */
export async function addMachineExercises(meta: Meta, body: unknown): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  const { keys } = parse<{ keys: string[] }>(machineSchema, body);
  const picked = [...new Set(keys)].map((k) => machineExercise(k));
  if (picked.some((e) => !e)) throw invalid([{ path: 'keys', rule: 'Exercice inconnu dans la bibliothèque des machines' }]);
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'exercise.machines', key: meta.idempotencyKey, body: { keys } }, async () => {
      const rows = (await tx.query<{ n: string; k: string | null }>('select lower(name) as n, starter_key as k from public.exercises where workspace_id = $1 and not archived', [wid])).rows;
      const names = new Set(rows.map((r) => r.n)), have = new Set(rows.map((r) => r.k));
      let added = 0;
      for (const e of picked as MachineExercise[]) {
        if (names.has(e.name.toLowerCase()) || have.has(e.key)) continue;
        await tx.query(
          `insert into public.exercises(workspace_id, owner_id, name, instructions, muscle, equipment, starter, starter_key) values ($1, auth.uid(), $2, $3, $4, $5, false, $6)`,
          [wid, e.name, machineInstructions(e), e.muscle, ['machine'], e.key],
        );
        names.add(e.name.toLowerCase());
        added++;
      }
      await audit(tx, wid, meta.actorId, 'exercise.machines', wid, meta.requestId);
      return { status: 200, body: { added, skipped: picked.length - added } };
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
  let old: string | null = null;
  const res = await commandAs(meta.actorId, async (tx) => {
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
    if (cur.rows[0].clip_id) old = await dropClip(tx, wid, cur.rows[0].clip_id);
    await audit(tx, wid, meta.actorId, 'exercise.clip', meta.exerciseId, meta.requestId);
    return { status: 200, body: { id: meta.exerciseId, clipId: c.rows[0]!.id, revision: r.rows[0]!.revision } };
  });
  await removeObjects(old ? [old] : []);
  return res;
}

/** Supprime la ligne d’une vidéo ; rend son adresse dans le stockage s’il y en a une (à retirer après validation). */
async function dropClip(tx: Tx, wid: string, clipId: string): Promise<string | null> {
  const r = await tx.query<{ object_path: string | null }>('delete from public.exercise_clips where workspace_id = $1 and id = $2 returning object_path', [wid, clipId]);
  return r.rows[0]?.object_path ?? null;
}

/** Retire les fichiers du stockage une fois la base à jour ; un échec laisse un fichier orphelin, jamais une vidéo cassée. */
async function removeObjects(paths: string[], store: VideoStore | null = videoStore()) {
  if (!paths.length || !store) return;
  await store.remove(paths).catch((e: unknown) => console.error(JSON.stringify({ module: 'exercises', code: 'STORAGE_REMOVE_FAILED', error: (e as Error)?.name })));
}

const startSchema = z.object({ contentType: z.enum(EXERCISE_CLIP_TYPES), size: z.number().int().min(1) }).strict();
const finishSchema = z.object({ clipId: z.string().uuid() }).strict();
const tooHeavy = () => invalid([{ path: 'video', rule: 'Vidéo trop lourde (50 Mio au plus, environ une minute)' }]);

async function requireExercise(actorId: string, wid: string, exerciseId: string) {
  await commandAs(actorId, async (tx) => {
    await requireCoach(tx, wid);
    const r = await tx.query('select 1 from public.exercises where workspace_id = $1 and id = $2', [wid, exerciseId]);
    if (!r.rows[0]) throw notVisible();
  });
}

/**
 * startExerciseClipUpload · C · D-173 : lien d’envoi direct vers le stockage privé, pour une nouvelle vidéo de l’exercice.
 * Sans stockage configuré (démonstration), « server » : la vidéo est envoyée à CoachOS comme avant.
 */
export async function startExerciseClipUpload(meta: Meta & { exerciseId: string }, body: unknown, store: VideoStore | null = videoStore()): Promise<StoredResponse> {
  const v = parse<{ contentType: string; size: number }>(startSchema, body);
  const wid = meta.workspaceId;
  await requireExercise(meta.actorId, wid, meta.exerciseId);
  if (!store) return { status: 200, body: { mode: 'server' } };
  if (v.size > EXERCISE_CLIP_STORAGE_MAX_BYTES) throw tooHeavy();
  const clipId = randomUUID();
  try {
    return { status: 200, body: { mode: 'direct', clipId, uploadUrl: await store.uploadUrl(clipObjectPath(wid, clipId)) } };
  } catch (e) {
    // Stockage injoignable (Supabase local lancé sans stockage, panne) : la vidéo passe par CoachOS, comme avant ; l’incident est signalé.
    console.error(JSON.stringify({ reqId: meta.requestId, module: 'exercises', code: 'STORAGE_UNAVAILABLE', error: (e as Error)?.name }));
    await reportError(e, { module: 'exercises', code: 'STORAGE_UNAVAILABLE', requestId: meta.requestId });
    return { status: 200, body: { mode: 'server' } };
  }
}

/**
 * finishExerciseClipUpload · C · D-173 : la vidéo envoyée est vérifiée (présente, reconnue par son contenu, 50 Mio au plus),
 * puis rattachée à l’exercice ; la précédente est retirée. Un fichier refusé est supprimé du stockage.
 */
export async function finishExerciseClipUpload(meta: Meta & { exerciseId: string }, body: unknown, store: VideoStore | null = videoStore()): Promise<StoredResponse> {
  const { clipId } = parse<{ clipId: string }>(finishSchema, body);
  const wid = meta.workspaceId;
  if (!store) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Le stockage des vidéos n’est pas disponible ici.');
  await requireExercise(meta.actorId, wid, meta.exerciseId);
  const path = clipObjectPath(wid, clipId);
  // Vérifié avant la transaction : on ne garde pas une connexion à la base pendant l’aller-retour au stockage.
  const found = await store.head(path);
  if (!found) throw invalid([{ path: 'video', rule: 'Vidéo introuvable : l’envoi n’est pas allé au bout. Renvoie-la.' }]);
  const type = detectVideoType(found.head);
  if (!type || found.size > EXERCISE_CLIP_STORAGE_MAX_BYTES) {
    await store.remove([path]).catch(() => undefined);
    throw type ? tooHeavy() : invalid([{ path: 'video', rule: 'Format non reconnu : MP4, MOV ou WebM' }]);
  }
  let old: string | null = null;
  const res = await commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'exercise.clip.finish', key: meta.idempotencyKey, body: { id: meta.exerciseId, clipId } }, async () => {
      const cur = await tx.query<{ clip_id: string | null; revision: number }>('select clip_id, revision from public.exercises where workspace_id = $1 and id = $2 for update', [wid, meta.exerciseId]);
      if (!cur.rows[0]) throw notVisible();
      if (cur.rows[0].clip_id === clipId) return { status: 200, body: { id: meta.exerciseId, clipId, revision: cur.rows[0].revision } };
      const taken = await tx.query('select 1 from public.exercise_clips where workspace_id = $1 and id = $2', [wid, clipId]);
      if (taken.rows[0]) throw conflict('Cette vidéo est déjà rattachée à un exercice.');
      await tx.query(
        'insert into public.exercise_clips(workspace_id, id, owner_id, content_type, object_path, size_bytes) values ($1, $2, auth.uid(), $3, $4, $5)',
        [wid, clipId, type, path, found.size],
      );
      const r = await tx.query<{ revision: number }>(
        'update public.exercises set clip_id = $3, revision = revision + 1 where workspace_id = $1 and id = $2 returning revision',
        [wid, meta.exerciseId, clipId],
      );
      if (cur.rows[0].clip_id) old = await dropClip(tx, wid, cur.rows[0].clip_id);
      await audit(tx, wid, meta.actorId, 'exercise.clip', meta.exerciseId, meta.requestId);
      return { status: 200, body: { id: meta.exerciseId, clipId, revision: r.rows[0]!.revision } };
    });
  });
  await removeObjects(old ? [old] : [], store);
  return res;
}

/** removeExerciseClip · C : retirer la vidéo filmée (le lien éventuel reste). */
export async function removeExerciseClip(meta: Meta & { exerciseId: string }): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  let old: string | null = null;
  const res = await commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'exercise.clip.remove', key: meta.idempotencyKey, body: { id: meta.exerciseId } }, async () => {
      const cur = await tx.query<{ clip_id: string | null }>('select clip_id from public.exercises where workspace_id = $1 and id = $2 for update', [wid, meta.exerciseId]);
      if (!cur.rows[0]) throw notVisible();
      const r = await tx.query<{ revision: number }>('update public.exercises set clip_id = null, revision = revision + 1 where workspace_id = $1 and id = $2 returning revision', [wid, meta.exerciseId]);
      if (cur.rows[0].clip_id) old = await dropClip(tx, wid, cur.rows[0].clip_id);
      await audit(tx, wid, meta.actorId, 'exercise.clip.remove', meta.exerciseId, meta.requestId);
      return { status: 200, body: { id: meta.exerciseId, revision: r.rows[0]!.revision } };
    });
  });
  await removeObjects(old ? [old] : []);
  return res;
}
