import type { NextRequest } from 'next/server';
import { addStarterExercises } from '@/server/commands/exercises';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** addStarterExercises · C · exercices de départ, sans doublon (D-096). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'exercises', (ctx) => addStarterExercises({ ...ctx, workspaceId: p.wid }));
}
