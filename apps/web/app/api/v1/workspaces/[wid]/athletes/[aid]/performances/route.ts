import type { NextRequest } from 'next/server';
import { addPerformance } from '@/server/commands/performances';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** addPerformance · C · résultat de référence de l’élève (D-060). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => addPerformance({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body));
}
