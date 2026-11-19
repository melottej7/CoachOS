import type { NextRequest } from 'next/server';
import { regenerateProgram } from '@/server/commands/programs';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; pid: string }> };

/** regenerateProgram · C · régénère les semaines demandées ; séances passées, réalisées ou retouchées protégées (D-063). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) => regenerateProgram({ ...ctx, workspaceId: p.wid, athleteId: p.aid, planId: p.pid }, ctx.body));
}
