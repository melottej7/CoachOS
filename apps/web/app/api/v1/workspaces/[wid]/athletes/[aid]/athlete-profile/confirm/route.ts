import type { NextRequest } from 'next/server';
import { confirmBilan } from '@/server/commands/athlete-profile';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** confirmBilan · C · le coach affecté confirme le bilan envoyé (D-054, CE-B-04). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => confirmBilan({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body));
}
