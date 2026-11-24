import type { NextRequest } from 'next/server';
import { moveWorkout } from '@/server/commands/workout-moves';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; sid: string }> };

/** moveWorkout · C · D-158 : déplacer à une autre date (nouvelle révision, rien n’est publié). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) =>
    moveWorkout({ ...ctx, workspaceId: p.wid, athleteId: p.aid, workoutId: p.sid }, ctx.body),
  );
}
