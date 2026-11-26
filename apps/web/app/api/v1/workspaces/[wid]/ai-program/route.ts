import type { NextRequest } from 'next/server';
import { proposeProgramDraft } from '@/server/commands/ai-program';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** IA-3 : l’agent peut lire plusieurs fois et écrire plusieurs semaines ; jusqu’à 2 minutes. */
export const maxDuration = 120;

/** proposeProgramDraft · C · brouillon de programme pour un élève ou un groupe ; rien n’est créé (IA-3, D-191). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'ai', (ctx) => proposeProgramDraft({ ...ctx, workspaceId: p.wid }, ctx.body));
}
