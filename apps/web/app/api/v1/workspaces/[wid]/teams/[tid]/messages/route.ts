import type { NextRequest } from 'next/server';
import { sendTeamMessage } from '@/server/commands/messages';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** sendTeamMessage · CA · message au groupe. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'messages', (ctx) => sendTeamMessage({ ...ctx, workspaceId: p.wid, teamId: p.tid }, ctx.body));
}
