import { NextResponse, type NextRequest } from 'next/server';
import { getActor } from '@/server/auth/session';
import { isUuid } from '@/server/repo/context';
import { readVoice } from '@/server/repo/messages';

/** Vocal privé : session requise, accès vérifié par le message qui le porte ; jamais mis en cache partagé. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ wid: string; vid: string }> }) {
  const { wid, vid } = await params;
  if (!isUuid(wid) || !isUuid(vid)) return new NextResponse(null, { status: 404 });
  const actor = await getActor();
  if (!actor) return new NextResponse(null, { status: 401 });
  const voice = await readVoice(actor.userId, wid, vid);
  if (!voice) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(voice.bytes), {
    status: 200,
    headers: {
      'content-type': voice.type,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
      'content-disposition': 'inline',
    },
  });
}
