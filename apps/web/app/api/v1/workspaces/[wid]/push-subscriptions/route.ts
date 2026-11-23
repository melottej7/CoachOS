import type { NextRequest } from 'next/server';
import { deletePushSubscription, savePushSubscription } from '@/server/commands/push';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** savePushSubscription · CA · abonnement push de cet appareil dans l’espace (D-118). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'push', (ctx) => savePushSubscription({ ...ctx, workspaceId: p.wid }, ctx.body));
}

/** deletePushSubscription · CA · oublier cet appareil (D-118). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'push', (ctx) => deletePushSubscription({ ...ctx, workspaceId: p.wid }, ctx.body));
}
