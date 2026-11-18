import type { NextRequest } from 'next/server';
import { createTask } from '@/server/commands/tasks';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createTask · C · tâche du coach (CE-H-02). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'tasks', (ctx) => createTask({ ...ctx, workspaceId: p.wid }, ctx.body));
}
