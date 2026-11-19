import type { NextRequest } from 'next/server';
import { weekFromAthlete } from '@/server/commands/library';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createWeekTemplate · C · enregistre la semaine d’un élève comme semaine type (D-051). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'calendar', (ctx) => weekFromAthlete({ ...ctx, workspaceId: p.wid }, ctx.body));
}
