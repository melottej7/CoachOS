import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { coachWorkout } from '@/server/repo/coach';
import { WorkoutForm } from '@/components/workout-form';
import { listBlockTemplates } from '@/server/repo/library';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { listExercises } from '@/server/repo/exercises';

export const metadata = { title: 'Modifier la séance' };

/** X21 : chaque enregistrement crée une révision immuable. */
export default async function EditWorkout({ params, searchParams }: { params: Promise<{ wid: string; aid: string; sid: string }>; searchParams: Promise<{ from?: string }> }) {
  const { wid, aid, sid } = await params;
  const { from } = await searchParams;
  // Retour sûr : seulement une page coach du même espace (séance de groupe, D-042).
  const returnTo = from && from.startsWith(`/coach/${wid}/`) && !from.includes('//') ? from : undefined;
  const actor = await requireActor();
  const w = await coachWorkout(actor.userId, wid, aid, sid);
  if (!w) notFound();
  const detail = `/coach/${wid}/athletes/${aid}/workouts/${sid}`;
  const r = w.working;
  return (
    <>
      <Link className="back" href={returnTo ?? detail}>{returnTo ? '← Séance de groupe' : '← Retour à la séance'}</Link>
      <div className="head"><div><div className="kicker">{w.athlete.displayName} · version {r.number}</div><h1>Modifier la séance</h1></div></div>
      <section className="card"><div className="card-body">
        <WorkoutForm exercises={(await listExercises(actor.userId, wid)).map((x) => ({ id: x.id, name: x.name }))} savedBlocks={await listBlockTemplates(actor.userId, wid)} refs={await readAthleteReferences(actor.userId, wid, aid)} wid={wid} aid={aid} athleteName={w.athlete.displayName} timeZone={r.timeZone} cancelHref={returnTo ?? detail} returnTo={returnTo}
          edit={{ sid, expectedRevision: r.number, published: w.published !== null }}
          initial={{ title: r.title, localDate: r.localDate, sport: r.sport, minutes: r.durationSeconds ? String(Math.round(r.durationSeconds / 60)) : '', instructions: r.instructions, intervals: r.intervals }} />
      </div></section>
    </>
  );
}
