import { notFound } from 'next/navigation';
import { canGiveFeedback, lastDoneByExercise, loadProgress, todayIn } from '@coachos/domain';
import { strengthHistory } from '@/server/repo/stats';
import { requireActor } from '@/server/auth/session';
import { athleteWorkout } from '@/server/repo/athlete';
import { athleteContext, isUuid } from '@/server/repo/context';
import { exerciseMap } from '@/server/repo/exercises';
import { FollowSession } from '@/views/athlete/follow-session';

export const metadata = { title: 'Suivre la séance' };

/** D-096 (M3) · Suivre la version publiée pas à pas, sur téléphone. */
export default async function FollowPage({ params }: { params: Promise<{ wid: string; sid: string }> }) {
  const { wid, sid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx || !isUuid(sid)) notFound();
  const found = await athleteWorkout(actor.userId, wid, ctx.athlete.id, sid);
  if (!found || found.workout.canceled || !found.workout.intervals.length) notFound();
  const w = found.workout;
  const open = canGiveFeedback(w.localDate, todayIn(ctx.athlete.timeZone), w.canceled);
  return (
    <FollowSession wid={wid} sid={sid} title={w.title} sport={w.sport} blocks={w.intervals}
      exercises={await exerciseMap(actor.userId, wid, w.intervals)}
      backHref={`/athlete/${wid}/workouts/${sid}`} feedbackHref={open ? `/athlete/${wid}/workouts/${sid}/feedback` : null}
      lastDone={lastDoneByExercise(loadProgress((await strengthHistory(actor.userId, wid, ctx.athlete.id)).filter((h) => h.date < w.localDate)))} />
  );
}
