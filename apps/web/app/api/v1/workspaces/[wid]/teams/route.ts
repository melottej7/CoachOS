import type { NextRequest } from 'next/server';
import { createTeam } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** createTeam · O · nouveau groupe (CE-G-01). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'portfolio', (ctx) => createTeam({ ...ctx, workspaceId: p.wid }, ctx.body));
}
