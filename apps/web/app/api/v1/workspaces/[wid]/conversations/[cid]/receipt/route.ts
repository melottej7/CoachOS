import type { NextRequest } from 'next/server';
import { saveReceipt } from '@/server/commands/messages';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; cid: string }> };

/** saveReceipt · CA · lu jusqu’à ce message. */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'messages', (ctx) => saveReceipt({ ...ctx, workspaceId: p.wid, conversationId: p.cid }, ctx.body));
}
