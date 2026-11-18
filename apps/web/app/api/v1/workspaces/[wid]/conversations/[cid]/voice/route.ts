import type { NextRequest } from 'next/server';
import { VOICE_MAX_BYTES } from '@coachos/domain';
import { sendVoice } from '@/server/commands/messages';
import { handleBinaryMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; cid: string }> };

/** sendVoice · CA · vocal de 3 minutes au plus (corps binaire, durée en paramètre ?seconds=). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  const seconds = Math.round(Number(req.nextUrl.searchParams.get('seconds')));
  return handleBinaryMutation(req, p, 'messages', VOICE_MAX_BYTES, (ctx) => sendVoice({ ...ctx, workspaceId: p.wid, conversationId: p.cid, seconds }, ctx.bytes));
}
