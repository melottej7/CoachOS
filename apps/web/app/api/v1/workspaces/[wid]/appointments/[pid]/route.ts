import type { NextRequest } from 'next/server';
import { updateAppointment } from '@/server/commands/tasks';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; pid: string }> };

/** updateAppointment · C · fait, annulé, préparation, compte rendu. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'tasks', (ctx) => updateAppointment({ ...ctx, workspaceId: p.wid, appointmentId: p.pid }, ctx.body));
}
