import type { NextRequest } from 'next/server';
import { askAssistant } from '@/server/commands/ai-assistant';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** askAssistant · C · « Demander » : réponse courte et brouillons ; rien n’est envoyé, publié ni créé (IA-4, D-192). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'ai', (ctx) => askAssistant({ ...ctx, workspaceId: p.wid }, ctx.body));
}
