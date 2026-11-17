import type { NextRequest } from 'next/server';
import { acceptInvitation } from '@/server/commands/invitations';
import { handleMutation } from '@/server/http';

/** acceptInvitation · U · e-mail vérifié, secret expirant, un seul lien. */
export async function POST(req: NextRequest) {
  return handleMutation(req, {}, 'roster', (ctx) => acceptInvitation(ctx, ctx.body));
}
