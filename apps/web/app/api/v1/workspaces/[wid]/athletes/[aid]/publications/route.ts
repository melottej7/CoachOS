import type { NextRequest } from 'next/server';
import { publishWorkouts } from '@/server/commands/workouts';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** publishBatch · C · 1 à 50 séances, atomique, refuse les doublons. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) =>
    publishWorkouts({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body),
  );
}
