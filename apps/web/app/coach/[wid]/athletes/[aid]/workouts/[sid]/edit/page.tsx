import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachWorkout } from '@/server/repo/coach';
import { WorkoutForm } from '@/components/workout-form';

export const metadata = { title: 'Modifier la séance' };

/** X21 : chaque enregistrement crée une révision immuable. */
export default async function EditWorkout({ params }: { params: Promise<{ wid: string; aid: string; sid: string }> }) {
  const { wid, aid, sid } = await params;
  const actor = await requireActor();
  const w = await coachWorkout(actor.userId, wid, aid, sid);
  if (!w) notFound();
  const detail = `/coach/${wid}/athletes/${aid}/workouts/${sid}`;
  const r = w.working;
  return (
    <>
      <Link className="back" href={detail}>← Retour à la séance</Link>
      <div className="head"><div><div className="kicker">{w.athlete.displayName} · version {r.number}</div><h1>Modifier la séance</h1></div></div>
      <section className="card"><div className="card-body">
        <WorkoutForm wid={wid} aid={aid} athleteName={w.athlete.displayName} timeZone={r.timeZone} cancelHref={detail}
          edit={{ sid, expectedRevision: r.number, published: w.published !== null }}
          initial={{ title: r.title, localDate: r.localDate, sport: r.sport, minutes: r.durationSeconds ? String(Math.round(r.durationSeconds / 60)) : '', instructions: r.instructions, intervals: r.intervals }} />
      </div></section>
    </>
  );
}
