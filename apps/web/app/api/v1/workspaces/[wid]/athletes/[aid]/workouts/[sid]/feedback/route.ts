import type { NextRequest } from 'next/server';
import { saveFeedback } from '@/server/commands/feedback';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; sid: string }> };

/** saveFeedback · A · révision observée, RPE 0..10, commentaire 1000 caractères. */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'feedback', (ctx) =>
    saveFeedback({ ...ctx, workspaceId: p.wid, athleteId: p.aid, workoutId: p.sid }, ctx.body),
  );
}
