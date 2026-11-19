import type { NextRequest } from 'next/server';
import { markNotificationRead } from '@/server/commands/notifications';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; nid: string }> };

/** markNotificationRead · CA · lecture répétée sans effet (D-067). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'notifications', (ctx) => markNotificationRead({ ...ctx, workspaceId: p.wid, notificationId: p.nid }));
}
