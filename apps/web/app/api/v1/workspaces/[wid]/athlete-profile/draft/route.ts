import type { NextRequest } from 'next/server';
import { saveBilanDraft } from '@/server/commands/athlete-profile';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** saveBilanDraft · A · réponses en cours du bilan, reprises sur n’importe quel appareil (D-054). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => saveBilanDraft({ ...ctx, workspaceId: p.wid }, ctx.body));
}
