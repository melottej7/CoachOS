import type { NextRequest } from 'next/server';
import { importProgram } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** importProgram · C · ancien programme du coach enregistré comme programme type (D-085). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'library', (ctx) => importProgram({ ...ctx, workspaceId: p.wid }, ctx.body));
}
