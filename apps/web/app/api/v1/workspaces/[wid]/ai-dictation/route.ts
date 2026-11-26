import type { NextRequest } from 'next/server';
import { dictateWorkout } from '@/server/commands/ai-dictation';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** dictateWorkout · C · brouillon de séance depuis le texte du coach ; rien n’est enregistré dans la séance (IA-1, D-189). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'ai', (ctx) => dictateWorkout({ ...ctx, workspaceId: p.wid }, ctx.body));
}
