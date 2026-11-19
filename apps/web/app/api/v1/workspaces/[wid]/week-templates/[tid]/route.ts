import type { NextRequest } from 'next/server';
import { updateWeekTemplate } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** updateWeekTemplate · C · renommer ou archiver une semaine type (D-051). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) => updateWeekTemplate({ ...ctx, workspaceId: p.wid, templateId: p.tid }, ctx.body));
}
