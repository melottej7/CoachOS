import type { NextRequest } from 'next/server';
import { VOICE_MAX_BYTES } from '@coachos/domain';
import { sendTeamVoice } from '@/server/commands/messages';
import { handleBinaryMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** sendTeamVoice · CA · vocal au groupe, 3 minutes au plus. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  const seconds = Math.round(Number(req.nextUrl.searchParams.get('seconds')));
  return handleBinaryMutation(req, p, 'messages', VOICE_MAX_BYTES, (ctx) => sendTeamVoice({ ...ctx, workspaceId: p.wid, teamId: p.tid, seconds }, ctx.bytes));
}
