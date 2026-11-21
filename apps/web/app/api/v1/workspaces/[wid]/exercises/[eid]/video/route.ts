import type { NextRequest } from 'next/server';
import { EXERCISE_CLIP_MAX_BYTES } from '@coachos/domain';
import { removeExerciseClip, uploadExerciseClip } from '@/server/commands/exercises';
import { handleBinaryMutation, handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; eid: string }> };

/** uploadExerciseClip · C · vidéo filmée par le coach (corps binaire, 25 Mio au plus, D-096). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleBinaryMutation(req, p, 'exercises', EXERCISE_CLIP_MAX_BYTES, (ctx) => uploadExerciseClip({ ...ctx, workspaceId: p.wid, exerciseId: p.eid }, ctx.bytes),
    { path: 'video', rule: 'Vidéo trop lourde (25 Mio au plus)' });
}

/** removeExerciseClip · C · retirer la vidéo filmée. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'exercises', (ctx) => removeExerciseClip({ ...ctx, workspaceId: p.wid, exerciseId: p.eid }));
}
