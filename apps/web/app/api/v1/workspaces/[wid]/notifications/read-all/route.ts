import type { NextRequest } from 'next/server';
import { markAllNotificationsRead } from '@/server/commands/notifications';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** markAllNotificationsRead · CA · tout marquer lu dans l’espace (D-067). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'notifications', (ctx) => markAllNotificationsRead({ ...ctx, workspaceId: p.wid }));
}
