import type { NextRequest } from 'next/server';
import { sendMessage } from '@/server/commands/messages';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; cid: string }> };

/** sendMessage · CA · message texte, envoi explicite. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'messages', (ctx) => sendMessage({ ...ctx, workspaceId: p.wid, conversationId: p.cid }, ctx.body));
}
