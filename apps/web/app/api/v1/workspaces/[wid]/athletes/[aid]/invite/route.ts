import type { NextRequest } from 'next/server';
import { issueInvitation } from '@/server/commands/invitations';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** issueInvitation · C · remplace le lien actif. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) =>
    issueInvitation({ ...ctx, workspaceId: p.wid, athleteId: p.aid, appOrigin: ctx.origin }, ctx.body),
  );
}
