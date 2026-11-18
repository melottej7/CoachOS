import type { NextRequest } from 'next/server';
import { saveAthleteReferences } from '@/server/commands/athlete-references';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** saveAthleteReferences · C · repères d’entraînement (VMA) fixés par le coach affecté. */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => saveAthleteReferences({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, ctx.body));
}
