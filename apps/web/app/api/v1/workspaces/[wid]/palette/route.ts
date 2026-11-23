import type { NextRequest } from 'next/server';
import { readPalette } from '@/server/repo/palette';
import { notVisible } from '@/server/errors';
import { handleQuery } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** readPalette · C · D-160 : élèves, groupes et séances types proposés par la palette ⌘K du coach. */
export async function GET(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleQuery(req, p, 'coach', async ({ actorId }) => {
    const data = await readPalette(actorId, p.wid);
    if (!data) throw notVisible();
    return { status: 200, body: data };
  });
}
