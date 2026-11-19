import type { NextRequest } from 'next/server';
import { saveNotificationSettings } from '@/server/commands/notifications';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** saveNotificationSettings · CA · e-mails « essentiels » ou aucun, pour cet espace (D-067). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'notifications', (ctx) => saveNotificationSettings({ ...ctx, workspaceId: p.wid }, ctx.body));
}
