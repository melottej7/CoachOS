import type { NextRequest } from 'next/server';
import { saveWorkspaceProfile } from '@/server/commands/workspace-profile';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** saveWorkspaceProfile · O · nom et présentation de l’espace. */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'workspace', (ctx) => saveWorkspaceProfile({ ...ctx, workspaceId: p.wid }, ctx.body));
}
