import type { NextRequest } from 'next/server';
import { updateTask } from '@/server/commands/tasks';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** updateTask · C · état, échéance, priorité (transitions vérifiées). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'tasks', (ctx) => updateTask({ ...ctx, workspaceId: p.wid, taskId: p.tid }, ctx.body));
}
