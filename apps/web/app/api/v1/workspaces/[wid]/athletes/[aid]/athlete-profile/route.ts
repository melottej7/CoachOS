import type { NextRequest } from 'next/server';
import { saveBilanByCoach } from '@/server/commands/athlete-profile';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** saveBilanByCoach · C · le coach affecté remplit le bilan pendant ou après l’entretien (D-054, CE-B-05). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => saveBilanByCoach({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body));
}
