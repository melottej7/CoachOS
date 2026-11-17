import type { NextRequest } from 'next/server';
import { saveAthleteProfile } from '@/server/commands/athlete-profile';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** saveAthleteProfile · A · profil sportif déclaré, sans donnée de santé. */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => saveAthleteProfile({ ...ctx, workspaceId: p.wid }, ctx.body));
}
