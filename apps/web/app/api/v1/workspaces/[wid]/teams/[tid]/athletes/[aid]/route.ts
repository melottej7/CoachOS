import type { NextRequest } from 'next/server';
import { setTeamMember } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; tid: string; aid: string }> };

/** addTeamMember · C · ajouter un élève affecté au groupe (CE-G-02). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => setTeamMember({ ...ctx, workspaceId: p.wid, teamId: p.tid, athleteId: p.aid }, true));
}

/** removeTeamMember · C · retirer l’élève du groupe ; les séances publiées ne changent pas. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => setTeamMember({ ...ctx, workspaceId: p.wid, teamId: p.tid, athleteId: p.aid }, false));
}
