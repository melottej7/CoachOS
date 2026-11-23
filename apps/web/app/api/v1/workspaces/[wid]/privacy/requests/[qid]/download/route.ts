import { NextResponse, type NextRequest } from 'next/server';
import { exportMyData, readPrivacyRequest } from '@/server/commands/privacy';
import { notVisible } from '@/server/errors';
import { handleQuery } from '@/server/http';

type Params = { params: Promise<{ wid: string; qid: string }> };

/** Export des données de la personne (accès, portabilité) : fichier JSON lisible, généré à la demande, jamais mis en cache. D-115. */
export async function GET(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleQuery(req, p, 'privacy', async ({ actorId }) => {
    const r = await readPrivacyRequest(actorId, p.wid, p.qid);
    if (!r?.downloadPath) throw notVisible();
    const data = await exportMyData(actorId, p.wid);
    if (!data) throw notVisible();
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="coachos-mes-donnees-${day}.json"`,
        'cache-control': 'private, no-store',
      },
    });
  });
}
