import type { NextRequest } from 'next/server';
import { createExercise } from '@/server/commands/exercises';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createExercise · C · nouvel exercice de musculation (D-096). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'exercises', (ctx) => createExercise({ ...ctx, workspaceId: p.wid }, ctx.body));
}
