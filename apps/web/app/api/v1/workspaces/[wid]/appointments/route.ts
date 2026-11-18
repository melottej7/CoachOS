import type { NextRequest } from 'next/server';
import { createAppointment } from '@/server/commands/tasks';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createAppointment · C · rendez-vous avec un élève (CE-H-05). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'tasks', (ctx) => createAppointment({ ...ctx, workspaceId: p.wid }, ctx.body));
}
