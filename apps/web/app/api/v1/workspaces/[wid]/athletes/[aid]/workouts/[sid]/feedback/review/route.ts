import type { NextRequest } from 'next/server';
import { markFeedbackReviewed } from '@/server/commands/feedback';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; sid: string }> };

/** markFeedbackReviewed · C · marque la version courante et clôt le cas lié. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'review', (ctx) =>
    markFeedbackReviewed({ ...ctx, workspaceId: p.wid, athleteId: p.aid, workoutId: p.sid }, ctx.body),
  );
}
