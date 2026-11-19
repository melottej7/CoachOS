import type { NextRequest } from 'next/server';
import { proposeProgramTweaks } from '@/server/commands/ai';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string; gid: string }> };

/** proposeProgramTweaks · C · « Ajuster avec l’IA » : réglages proposés, rien n’est modifié (D-071). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'ai', (ctx) => proposeProgramTweaks({ ...ctx, workspaceId: p.wid, athleteId: p.aid, goalId: p.gid }, ctx.body));
}
