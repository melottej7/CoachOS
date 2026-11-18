import type { NextRequest } from 'next/server';
import { saveTeamReceipt } from '@/server/commands/messages';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** saveTeamReceipt · CA · lu jusqu’à ce message du groupe. */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'messages', (ctx) => saveTeamReceipt({ ...ctx, workspaceId: p.wid, teamId: p.tid }, ctx.body));
}
