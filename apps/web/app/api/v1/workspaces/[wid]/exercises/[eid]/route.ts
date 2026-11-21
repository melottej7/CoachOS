import type { NextRequest } from 'next/server';
import { updateExercise } from '@/server/commands/exercises';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; eid: string }> };

/** updateExercise · C · modifier ou retirer un exercice (D-096). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'exercises', (ctx) => updateExercise({ ...ctx, workspaceId: p.wid, exerciseId: p.eid }, ctx.body));
}
