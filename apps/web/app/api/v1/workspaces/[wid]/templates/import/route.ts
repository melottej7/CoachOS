import type { NextRequest } from 'next/server';
import { importLibrary } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** importLibrary · C · séances de la base du coach, vérifiées dans l’aperçu (D-079). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'library', (ctx) => importLibrary({ ...ctx, workspaceId: p.wid }, ctx.body));
}
