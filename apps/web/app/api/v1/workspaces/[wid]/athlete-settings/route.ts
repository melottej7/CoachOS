import type { NextRequest } from 'next/server';
import { updateAthleteSettings } from '@/server/commands/profile';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** updateAthleteSettings · A · fuseau de la relation, sans redater les séances. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => updateAthleteSettings({ ...ctx, workspaceId: p.wid }, ctx.body));
}
