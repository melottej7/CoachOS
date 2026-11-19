import type { NextRequest } from 'next/server';
import { decideGoal } from '@/server/commands/goal-decisions';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; gid: string }> };

/** decideGoal · C · le coach valide un objectif (tel quel ou ajusté) ; contrainte du futur programme (D-058). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => decideGoal({ ...ctx, workspaceId: p.wid, athleteId: p.aid, goalId: p.gid }, ctx.body));
}
