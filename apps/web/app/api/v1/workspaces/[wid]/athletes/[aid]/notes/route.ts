import type { NextRequest } from 'next/server';
import { createNote } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** createCoachNote · C · note privée de l’auteur (CE-G-07). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => createNote({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body));
}
