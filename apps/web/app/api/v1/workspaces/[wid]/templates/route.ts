import type { NextRequest } from 'next/server';
import { createTemplate } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createTemplate · C · séance de bibliothèque (D-035). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'library', (ctx) => createTemplate({ ...ctx, workspaceId: p.wid }, ctx.body));
}
