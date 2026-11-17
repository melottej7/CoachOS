import type { NextRequest } from 'next/server';
import { createAthlete } from '@/server/commands/invitations';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createAthlete · O · dossier invité affecté au propriétaire. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => createAthlete({ ...ctx, workspaceId: p.wid }, ctx.body));
}
