import type { NextRequest } from 'next/server';
import { discardWorkout } from '@/server/commands/workout-moves';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; sid: string }> };

/** discardWorkout · C · D-158 : retirer un brouillon jamais publié (révision d’annulation). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) =>
    discardWorkout({ ...ctx, workspaceId: p.wid, athleteId: p.aid, workoutId: p.sid }, ctx.body),
  );
}
