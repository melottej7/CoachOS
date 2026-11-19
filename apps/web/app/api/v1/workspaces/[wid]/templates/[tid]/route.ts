import type { NextRequest } from 'next/server';
import { updateTemplate } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** updateTemplate · C · modifier, reclasser, archiver. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'library', (ctx) => updateTemplate({ ...ctx, workspaceId: p.wid, templateId: p.tid }, ctx.body));
}
