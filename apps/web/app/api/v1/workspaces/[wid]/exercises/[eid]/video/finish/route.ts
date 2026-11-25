import type { NextRequest } from 'next/server';
import { finishExerciseClipUpload } from '@/server/commands/exercises';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; eid: string }> };

/** finishExerciseClipUpload · C · vérifier la vidéo envoyée au stockage et la rattacher à l’exercice (D-173). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'exercises', (ctx) => finishExerciseClipUpload({ ...ctx, workspaceId: p.wid, exerciseId: p.eid }, ctx.body));
}
