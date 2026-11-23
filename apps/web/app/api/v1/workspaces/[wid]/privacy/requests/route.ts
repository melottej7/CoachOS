import type { NextRequest } from 'next/server';
import { openPrivacyRequest } from '@/server/commands/privacy';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** openPrivacyRequest · CA · accès, portabilité (immédiats), effacement, rectification (demande à 30 jours). D-115. */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'privacy', (ctx) => openPrivacyRequest({ ...ctx, workspaceId: p.wid }, ctx.body));
}
