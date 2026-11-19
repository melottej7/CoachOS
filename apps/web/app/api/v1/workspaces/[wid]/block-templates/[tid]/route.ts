import type { NextRequest } from 'next/server';
import { archiveBlockTemplate } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** archiveBlockTemplate · C · retire un bloc réutilisable (D-074). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'library', (ctx) => archiveBlockTemplate({ ...ctx, workspaceId: p.wid, templateId: p.tid }));
}
