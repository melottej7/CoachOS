import type { NextRequest } from 'next/server';
import { applyWeekProposal } from '@/server/commands/week-proposals';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** applyWeekProposal · C · applique une proposition d’adaptation de la semaine en brouillons (D-056). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) => applyWeekProposal({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body));
}
