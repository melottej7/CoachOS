import type { NextRequest } from 'next/server';
import { readPrivacyRequest } from '@/server/commands/privacy';
import { notVisible } from '@/server/errors';
import { handleQuery } from '@/server/http';

type Params = { params: Promise<{ wid: string; qid: string }> };

/** readPrivacyRequest · CA · état d’une demande et adresse de téléchargement d’un export (D-115). */
export async function GET(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleQuery(req, p, 'privacy', async ({ actorId }) => {
    const r = await readPrivacyRequest(actorId, p.wid, p.qid);
    if (!r) throw notVisible();
    return { status: 200, body: { id: r.id, state: r.state, downloadUrl: r.downloadPath ? new URL(r.downloadPath, req.nextUrl.origin).toString() : null } };
  });
}
