import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocalDate, todayIn, weekStart, type Sport } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { listAssignedAthletes } from '@/server/repo/coach';
import { WorkoutForm } from '@/components/workout-form';

export const metadata = { title: 'Nouvelle séance' };

/** X20 : créer une prescription, enregistrée en brouillon. */
export default async function NewWorkout({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ date?: string }> }) {
  const { wid, aid } = await params;
  const { date } = await searchParams;
  const actor = await requireActor();
  const athlete = (await listAssignedAthletes(actor.userId, wid)).find((a) => a.id === aid);
  if (!athlete) notFound();
  const localDate = date && isLocalDate(date) ? date : todayIn(athlete.timeZone);
  const back = `/coach/${wid}/calendar?athlete=${aid}&week=${weekStart(localDate)}`;
  return (
    <>
      <Link className="back" href={back}>← Planning de {athlete.displayName}</Link>
      <div className="head"><div><div className="kicker">{athlete.displayName}</div><h1>Nouvelle séance</h1></div></div>
      <section className="card"><div className="card-body">
        <WorkoutForm wid={wid} aid={aid} athleteName={athlete.displayName} timeZone={athlete.timeZone} cancelHref={back}
          initial={{ title: '', localDate, sport: 'running' satisfies Sport, minutes: '45', instructions: '' }} />
      </div></section>
    </>
  );
}
