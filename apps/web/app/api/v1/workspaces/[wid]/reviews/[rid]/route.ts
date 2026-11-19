import type { NextRequest } from 'next/server';
import { updateReview } from '@/server/commands/feedback';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; rid: string }> };

/** updateReview · C · reporter un retour à une date future ou le remettre dans la file (D-082). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'review', (ctx) => updateReview({ ...ctx, workspaceId: p.wid, reviewId: p.rid }, ctx.body));
}
