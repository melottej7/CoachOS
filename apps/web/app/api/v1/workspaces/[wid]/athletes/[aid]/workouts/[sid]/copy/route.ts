import type { NextRequest } from 'next/server';
import { copyWorkout } from '@/server/commands/workout-moves';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; sid: string }> };

/** copyWorkout · C · D-158 : copier en brouillon pour cet élève ou un autre élève suivi. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) =>
    copyWorkout({ ...ctx, workspaceId: p.wid, athleteId: p.aid, workoutId: p.sid }, ctx.body),
  );
}
