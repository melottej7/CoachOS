import type { NextRequest } from 'next/server';
import { addFouleeLibrary } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** addFouleeLibrary · C · bibliothèque Foulée, 324 séances par paliers (D-068). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'library', (ctx) => addFouleeLibrary({ ...ctx, workspaceId: p.wid }));
}
