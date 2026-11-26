import type { NextRequest } from 'next/server';
import { proposeExerciseCues } from '@/server/commands/ai-library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** proposeExerciseCues · C · consignes proposées pour un exercice, « À relire » ; rien n’est enregistré (IA-5, D-193). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'ai', (ctx) => proposeExerciseCues({ ...ctx, workspaceId: p.wid }, ctx.body));
}
