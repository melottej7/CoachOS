import type { NextRequest } from 'next/server';
import { updateGoal } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; gid: string }> };

/** updateGoal · C · atteint, abandonné, nouvelle échéance. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => updateGoal({ ...ctx, workspaceId: p.wid, athleteId: p.aid, goalId: p.gid }, ctx.body));
}
