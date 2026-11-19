import type { NextRequest } from 'next/server';
import { publishGroupSession } from '@/server/commands/group-sessions';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; gid: string }> };

/** publishGroupSession · C · publication explicite et atomique des séances choisies (D-042). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'workouts', (ctx) => publishGroupSession({ ...ctx, workspaceId: p.wid, groupSessionId: p.gid }, ctx.body));
}
