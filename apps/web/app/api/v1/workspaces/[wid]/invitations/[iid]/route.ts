import type { NextRequest } from 'next/server';
import { revokeInvitation } from '@/server/commands/invitations';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; iid: string }> };

/** revokeInvitation · O · révocation idempotente. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => revokeInvitation({ ...ctx, workspaceId: p.wid, invitationId: p.iid }));
}
