import type { NextRequest } from 'next/server';
import { restoreWorkout } from '@/server/commands/workout-moves';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; sid: string }> };

/** restoreWorkout · C · D-158 : rétablir un brouillon retiré. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) =>
    restoreWorkout({ ...ctx, workspaceId: p.wid, athleteId: p.aid, workoutId: p.sid }, ctx.body),
  );
}
