import type { NextRequest } from 'next/server';
import { addMachineExercises } from '@/server/commands/exercises';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** addMachineExercises · C · exercices de la bibliothèque des machines, sans doublon (D-179). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'exercises', (ctx) => addMachineExercises({ ...ctx, workspaceId: p.wid }, ctx.body));
}
