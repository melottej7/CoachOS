import { NextResponse, type NextRequest } from 'next/server';
import { FIT_MIME, fitFileName, fitUnavailableReason, workoutToFit } from '@coachos/domain';
import { getActor } from '@/server/auth/session';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { athleteWorkout } from '@/server/repo/athlete';
import { isUuid } from '@/server/repo/context';

/**
 * Fichier FIT d’une séance (CE-X-01, D-044). Session requise ; lecture sous RLS :
 * l’élève obtient la version publiée, le coach affecté la version en cours. Rien n’est envoyé à un tiers.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ wid: string; aid: string; sid: string }> }) {
  const { wid, aid, sid } = await params;
  if (![wid, aid, sid].every(isUuid)) return new NextResponse(null, { status: 404 });
  const actor = await getActor();
  if (!actor) return new NextResponse(null, { status: 401 });
  const found = await athleteWorkout(actor.userId, wid, aid, sid);
  if (!found) return new NextResponse(null, { status: 404 });
  const w = found.workout;
  const reason = fitUnavailableReason(w.intervals, w.canceled);
  if (reason) return new NextResponse(reason, { status: 409, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'private, no-store' } });
  const refs = await readAthleteReferences(actor.userId, wid, aid);
  const bytes = workoutToFit({ title: w.title, sport: w.sport, blocks: w.intervals, refs, instructions: w.instructions, durationSeconds: w.durationSeconds });
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'content-type': FIT_MIME,
      'content-disposition': `attachment; filename="${fitFileName(w.localDate, w.title)}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'",
    },
  });
}
