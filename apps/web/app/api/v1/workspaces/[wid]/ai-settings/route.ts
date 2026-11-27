import type { NextRequest } from 'next/server';
import { setWorkspaceAi } from '@/server/ai/settings';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** setWorkspaceAi · O · allumer ou éteindre l’IA pour tout l’espace (IA-0). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'ai', (ctx) => setWorkspaceAi({ ...ctx, workspaceId: p.wid }, ctx.body));
}
