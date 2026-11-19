import type { NextRequest } from 'next/server';
import { saveAutoRuleSettings } from '@/server/commands/tasks';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** saveAutoRuleSettings · C · activer ou désactiver chaque suivi automatique et régler son délai (CE-H-04). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'tasks', (ctx) => saveAutoRuleSettings({ ...ctx, workspaceId: p.wid }, ctx.body));
}
