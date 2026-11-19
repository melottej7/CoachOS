import type { NextRequest } from 'next/server';
import { saveCoachMethod } from '@/server/commands/coach-method';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** saveCoachMethod · C · méthode du coach, nouvelle version active (D-072). */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'method', (ctx) => saveCoachMethod({ ...ctx, workspaceId: p.wid }, ctx.body));
}
