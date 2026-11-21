import type { NextRequest } from 'next/server';
import { saveRelanceTemplate } from '@/server/commands/relance-templates';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** saveRelanceTemplate · C · modèle de relance du coach pour une situation ; body null = modèle de CoachOS (D-104). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'relances', (ctx) => saveRelanceTemplate({ ...ctx, workspaceId: p.wid }, ctx.body));
}
