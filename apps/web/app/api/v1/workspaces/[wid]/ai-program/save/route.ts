import type { NextRequest } from 'next/server';
import { saveAiProgram } from '@/server/commands/ai-program';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** saveAiProgram · C · enregistre en brouillon le programme relu ; rien n’est publié (IA-3, D-191). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'ai', (ctx) => saveAiProgram({ ...ctx, workspaceId: p.wid }, ctx.body));
}
