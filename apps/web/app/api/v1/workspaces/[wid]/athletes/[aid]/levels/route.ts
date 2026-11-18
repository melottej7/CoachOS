import type { NextRequest } from 'next/server';
import { confirmLevel } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** confirmLevel · C · niveau par sport confirmé par le coach (CE-G-05). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => confirmLevel({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body));
}
