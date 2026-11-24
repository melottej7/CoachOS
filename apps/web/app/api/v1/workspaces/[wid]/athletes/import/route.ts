import type { NextRequest } from 'next/server';
import { importRoster } from '@/server/commands/invitations';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** importRoster · O · plusieurs fiches invitées, groupes et liens d’invitation à transmettre soi-même (D-169). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => importRoster({ ...ctx, workspaceId: p.wid, appOrigin: ctx.origin }, ctx.body));
}
