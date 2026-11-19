import type { NextRequest } from 'next/server';
import { createBlockTemplate } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createBlockTemplate · C · bloc réutilisable de la bibliothèque (D-074). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'library', (ctx) => createBlockTemplate({ ...ctx, workspaceId: p.wid }, ctx.body));
}
