import type { NextRequest } from 'next/server';
import { openConversation } from '@/server/commands/messages';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** openConversation · CA · fil privé de l’élève (créé au besoin). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'messages', (ctx) => openConversation({ ...ctx, workspaceId: p.wid, athleteId: p.aid }));
}
