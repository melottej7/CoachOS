import { NextResponse, type NextRequest } from 'next/server';
import { getActor } from '@/server/auth/session';
import { isUuid } from '@/server/repo/context';
import { readExerciseClip } from '@/server/repo/exercises';
import { READ_URL_SECONDS, videoStore } from '@/server/storage/video-store';

const CHUNK = 4 * 1024 * 1024;

/**
 * D-096 · Vidéo filmée d’un exercice : session requise, lue par le coach et les élèves de l’espace.
 * Les plages d’octets (Range) sont servies : Safari sur iPhone en a besoin pour lire une vidéo.
 * D-173 : une vidéo du stockage privé est lue par un lien signé de courte durée, délivré après le même contrôle ;
 * le stockage sert lui-même les plages d’octets, sans la limite de 4,5 Mo de Vercel.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ wid: string; eid: string }> }) {
  const { wid, eid } = await params;
  if (!isUuid(wid) || !isUuid(eid)) return new NextResponse(null, { status: 404 });
  const actor = await getActor();
  if (!actor) return new NextResponse(null, { status: 401 });
  const clip = await readExerciseClip(actor.userId, wid, eid);
  if (!clip) return new NextResponse(null, { status: 404 });
  if (clip.path !== undefined) {
    const store = videoStore();
    if (!store) return new NextResponse(null, { status: 404 });
    const url = await store.readUrl(clip.path, READ_URL_SECONDS);
    return NextResponse.redirect(url, { status: 302, headers: { 'cache-control': 'private, max-age=300', 'referrer-policy': 'no-referrer' } });
  }
  const bytes = clip.bytes;
  const size = bytes.length;
  const base = {
    'content-type': clip.type,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'",
    'content-disposition': 'inline',
  };
  const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
  // D-113 · Vercel refuse les réponses de plus de 4,5 Mo : on sert la vidéo par morceaux de 4 Mo au plus.
  // Le lecteur demande lui-même le morceau suivant.
  if ((range && (range[1] || range[2])) || size > CHUNK) {
    let start = range?.[1] ? Number(range[1]) : range?.[2] ? size - Number(range[2]) : 0;
    let end = range?.[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(size - 1, end, start + CHUNK - 1);
    if (start > end || start >= size) return new NextResponse(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
    return new NextResponse(new Uint8Array(bytes.subarray(start, end + 1)), {
      status: 206, headers: { ...base, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
    });
  }
  return new NextResponse(new Uint8Array(bytes), { status: 200, headers: { ...base, 'content-length': String(size) } });
}
