import type { NextRequest } from 'next/server';
import { createWorkspace } from '@/server/commands/invitations';
import { handleMutation } from '@/server/http';

/** createWorkspace · U · espace et propriétaire dans un seul commit. */
export async function POST(req: NextRequest) {
  return handleMutation(req, {}, 'auth', (ctx) => createWorkspace(ctx, ctx.body));
}
