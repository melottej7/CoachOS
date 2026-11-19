import type { NextRequest } from 'next/server';
import { updateGroupBase } from '@/server/commands/group-sessions';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; gid: string }> };

/** updateGroupBase · C · modifie la base commune et la répercute sur les séances qui la suivent encore (D-046). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) => updateGroupBase({ ...ctx, workspaceId: p.wid, groupSessionId: p.gid }, ctx.body));
}
