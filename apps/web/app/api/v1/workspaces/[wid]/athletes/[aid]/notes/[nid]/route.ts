import type { NextRequest } from 'next/server';
import { deleteNote } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; nid: string }> };

/** deleteCoachNote · C · l’auteur efface sa note. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => deleteNote({ ...ctx, workspaceId: p.wid, athleteId: p.aid, noteId: p.nid }));
}
