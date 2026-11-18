import type { NextRequest } from 'next/server';
import { updateTeam } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string }> };

/** updateTeam · O · renommer, réordonner, archiver (CE-G-01). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => updateTeam({ ...ctx, workspaceId: p.wid, teamId: p.tid }, ctx.body));
}
