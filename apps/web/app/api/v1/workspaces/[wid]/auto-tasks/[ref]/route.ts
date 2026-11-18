import type { NextRequest } from 'next/server';
import { snoozeAutoTask } from '@/server/commands/tasks';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; ref: string }> };

/** snoozeAutoTask · C · reporter ou réactiver un suivi automatique (CE-H-03). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'tasks', (ctx) => snoozeAutoTask({ ...ctx, workspaceId: p.wid, sourceRef: p.ref }, ctx.body));
}
