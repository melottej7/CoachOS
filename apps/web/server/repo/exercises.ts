import { exerciseIdsOf, type Block, type Exercise, type ExerciseEquipment, type Muscle } from '@coachos/domain';
import { commandAs, readAs } from '../db/client';

// D-096 · Lecture des exercices : coach et élèves de l’espace (RLS). Les octets d’une vidéo filmée ne sont lus
// qu’après ce contrôle, par la route privée.

interface Row {
  id: string; revision: number; name: string; instructions: string | null; muscle: Muscle; equipment: ExerciseEquipment[];
  video_url: string | null; clip_id: string | null; starter: boolean; archived: boolean; starter_key: string | null; use_base_video: boolean;
}

const toExercise = (x: Row): Exercise => ({
  id: x.id, revision: x.revision, name: x.name, instructions: x.instructions, muscle: x.muscle, equipment: x.equipment ?? [],
  videoUrl: x.video_url, clipId: x.clip_id, starter: x.starter, archived: x.archived, starterKey: x.starter_key, useBaseVideo: x.use_base_video,
});

const COLS = 'id, revision, name, instructions, muscle, equipment, video_url, clip_id, starter, archived, starter_key, use_base_video';

export async function listExercises(userId: string, wid: string, opts: { archived?: boolean } = {}): Promise<Exercise[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(`select ${COLS} from public.exercises where workspace_id = $1 and archived = $2 order by lower(name), id`, [wid, Boolean(opts.archived)]);
    return r.rows.map(toExercise);
  });
}

/** Exercices nommés par une séance (même retirés de la bibliothèque) : leur vidéo reste visible par l’élève. */
export async function exercisesByIds(userId: string, wid: string, ids: string[]): Promise<Exercise[]> {
  if (!ids.length) return [];
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(`select ${COLS} from public.exercises where workspace_id = $1 and id = any($2::uuid[])`, [wid, ids]);
    return r.rows.map(toExercise);
  });
}

export async function readExercise(userId: string, wid: string, id: string): Promise<Exercise | null> {
  return (await exercisesByIds(userId, wid, [id]))[0] ?? null;
}

/** Vidéo filmée d’un exercice, si l’exercice est visible par cette personne. */
/** Vidéo filmée d’un exercice, pour qui peut lire l’exercice : en base (octets) ou, depuis D-173, dans le stockage (adresse). */
export type StoredClip = { type: string; bytes: Buffer; path?: undefined } | { type: string; path: string; bytes?: undefined };
export async function readExerciseClip(userId: string, wid: string, exerciseId: string): Promise<StoredClip | null> {
  const ex = await readExercise(userId, wid, exerciseId);
  if (!ex?.clipId) return null;
  return commandAs(userId, async (tx) => {
    const r = await tx.query<{ content_type: string; bytes: Buffer | Uint8Array | null; object_path: string | null }>(
      'select content_type, bytes, object_path from public.exercise_clips where workspace_id = $1 and id = $2', [wid, ex.clipId]);
    const x = r.rows[0];
    if (!x) return null;
    return x.object_path ? { type: x.content_type, path: x.object_path } : x.bytes ? { type: x.content_type, bytes: Buffer.from(x.bytes) } : null;
  });
}

/** D-096 : consignes et vidéos des exercices nommés par une ou plusieurs versions de séance, par identifiant. */
export async function exerciseMap(userId: string, wid: string, ...structures: Block[][]): Promise<Record<string, Exercise>> {
  const ids = [...new Set(structures.flatMap(exerciseIdsOf))];
  return Object.fromEntries((await exercisesByIds(userId, wid, ids)).map((e) => [e.id, e]));
}
