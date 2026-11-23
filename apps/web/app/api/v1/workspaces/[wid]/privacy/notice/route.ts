import type { NextRequest } from 'next/server';
import { readNotice } from '@/server/commands/privacy';
import { notVisible } from '@/server/errors';
import { handleQuery } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** readNotice · CA · version et résumé de la politique de confidentialité (D-115). */
export async function GET(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleQuery(req, p, 'privacy', async ({ actorId }) => {
    const notice = await readNotice(actorId, p.wid);
    if (!notice) throw notVisible();
    return { status: 200, body: notice };
  });
}
