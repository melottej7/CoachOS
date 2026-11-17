import type { NextRequest } from 'next/server';
import { createWorkout } from '@/server/commands/workouts';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** createWorkout · C · écrit parent et première révision en transaction. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) =>
    createWorkout({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body),
  );
}
