import type { NextRequest } from 'next/server';
import { createGroupSession } from '@/server/commands/group-sessions';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createGroupSession · C · séance de groupe : un brouillon par élève choisi (D-042). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'workouts', (ctx) => createGroupSession({ ...ctx, workspaceId: p.wid }, ctx.body));
}
