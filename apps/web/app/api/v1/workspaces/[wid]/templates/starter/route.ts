import type { NextRequest } from 'next/server';
import { addStarterLibrary } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** addStarterLibrary · C · séances de départ (modèles rapides complets). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'library', (ctx) => addStarterLibrary({ ...ctx, workspaceId: p.wid }));
}
