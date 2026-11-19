import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canGiveFeedback, formatShortDate, todayIn } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteWorkout } from '@/server/repo/athlete';
import { athleteContext, isUuid } from '@/server/repo/context';
import { FeedbackForm } from '@/components/feedback-form';

export const metadata = { title: 'Mon retour' };

/** X43 : décrire le réalisé. */
export default async function FeedbackPage({ params }: { params: Promise<{ wid: string; sid: string }> }) {
  const { wid, sid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx || !isUuid(sid)) notFound();
  const found = await athleteWorkout(actor.userId, wid, ctx.athlete.id, sid);
  if (!found) notFound();
  const { workout: w, feedback } = found;
  const back = `/athlete/${wid}/workouts/${sid}`;
  if (!canGiveFeedback(w.localDate, todayIn(ctx.athlete.timeZone), w.canceled)) {
    return (<><Link className="back" href={back}>← Séance</Link><h1>Mon retour</h1><p className="sub">Le retour s’ouvre le jour de la séance.</p></>);
  }
  return (
    <>
      <Link className="back" href={back}>← {w.title}</Link>
      <div className="kicker">{w.title} · {formatShortDate(w.localDate)}</div>
      <h1>Mon retour</h1>
      <div style={{ marginTop: 16 }}>
        <FeedbackForm wid={wid} aid={ctx.athlete.id} sid={sid} publishedRevision={w.revision} workspaceName={ctx.workspace.name}
          plannedMinutes={w.durationSeconds ? Math.round(w.durationSeconds / 60) : null}
          intervals={w.intervals} sport={w.sport} plannedDate={w.localDate} timeZone={ctx.athlete.timeZone}
          existing={feedback ? { revision: feedback.revision, state: feedback.state, durationSeconds: feedback.durationSeconds, distanceM: feedback.distanceM, rpe: feedback.rpe, comment: feedback.comment, overallFeeling: feedback.overallFeeling, difficulties: feedback.difficulties, changes: feedback.changes, actualSport: feedback.actualSport, repeatsDone: feedback.repeatsDone, measureFile: feedback.measureFile, activities: feedback.activities } : null} />
      </div>
    </>
  );
}
