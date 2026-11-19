import type { NextRequest } from 'next/server';
import { createProgram } from '@/server/commands/programs';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; gid: string }> };

/** createProgram · C · programme généré en brouillons pour un objectif validé ; risques acceptés par le coach (D-061). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) => createProgram({ ...ctx, workspaceId: p.wid, athleteId: p.aid, goalId: p.gid }, ctx.body));
}
