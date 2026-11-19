import type { NextRequest } from 'next/server';
import { deletePerformance } from '@/server/commands/performances';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; pid: string }> };

/** deletePerformance · C · retirer un résultat de référence (D-060). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => deletePerformance({ ...ctx, workspaceId: p.wid, athleteId: p.aid, performanceId: p.pid }));
}
