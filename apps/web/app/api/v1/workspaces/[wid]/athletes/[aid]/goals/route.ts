import type { NextRequest } from 'next/server';
import { createGoal } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** createGoal · C · objectif visible par l’élève (CE-G-08). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => createGoal({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body));
}
