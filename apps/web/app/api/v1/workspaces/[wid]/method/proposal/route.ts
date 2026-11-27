import type { NextRequest } from 'next/server';
import { proposeMethod } from '@/server/commands/ai-method';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** proposeMethod · C · proposition de méthode depuis la bibliothèque du coach ; rien n’est enregistré (IA-2, D-190). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'ai', (ctx) => proposeMethod({ ...ctx, workspaceId: p.wid }, ctx.body));
}
