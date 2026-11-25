import type { NextRequest } from 'next/server';
import { startExerciseClipUpload } from '@/server/commands/exercises';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; eid: string }> };

/** startExerciseClipUpload · C · lien d’envoi direct vers le stockage privé, ou « server » sans stockage (D-173). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'exercises', (ctx) => startExerciseClipUpload({ ...ctx, workspaceId: p.wid, exerciseId: p.eid }, ctx.body));
}
