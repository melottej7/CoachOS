import type { NextRequest } from 'next/server';
import { updateWorkout } from '@/server/commands/workouts';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; sid: string }> };

/** updateWorkout · C · crée une version immuable, 409 si révision périmée. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) =>
    updateWorkout({ ...ctx, workspaceId: p.wid, athleteId: p.aid, workoutId: p.sid }, ctx.body),
  );
}
