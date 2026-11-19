import type { NextRequest } from 'next/server';
import { applyWeekTemplate } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** applyWeekTemplate · C · un brouillon par séance de la semaine type pour un élève, rien de publié (D-051). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) => applyWeekTemplate({ ...ctx, workspaceId: p.wid, templateId: p.tid }, ctx.body));
}
