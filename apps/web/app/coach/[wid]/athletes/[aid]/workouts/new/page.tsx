import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocalDate, todayIn, weekStart, type Sport } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { listAssignedAthletes } from '@/server/repo/coach';
import { WorkoutForm } from '@/components/workout-form';
import { listBlockTemplates } from '@/server/repo/library';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { readTemplate } from '@/server/repo/library';
import { isUuid } from '@/server/repo/context';

export const metadata = { title: 'Nouvelle séance' };

/** X20 : créer une prescription, enregistrée en brouillon. */
export default async function NewWorkout({ params, searchParams }: { params: Promise<{ wid: string; aid: string }>; searchParams: Promise<{ date?: string; template?: string }> }) {
  const { wid, aid } = await params;
  const { date, template } = await searchParams;
  const actor = await requireActor();
  const athlete = (await listAssignedAthletes(actor.userId, wid)).find((a) => a.id === aid);
  if (!athlete) notFound();
  const localDate = date && isLocalDate(date) ? date : todayIn(athlete.timeZone);
  const back = `/coach/${wid}/calendar?athlete=${aid}&week=${weekStart(localDate)}`;
  // Depuis la bibliothèque : la séance part du modèle choisi, modifiable avant enregistrement.
  const t = template && isUuid(template) ? await readTemplate(actor.userId, wid, template) : null;
  const w = t?.workout;
  return (
    <>
      <Link className="back" href={back}>← Planning de {athlete.displayName}</Link>
      <div className="head"><div><div className="kicker">{athlete.displayName}</div><h1>Nouvelle séance</h1>
        {w ? <p className="sub">À partir de « {w.title} » (bibliothèque). Ajuste-la pour {athlete.displayName.split(' ')[0]} : la séance de la bibliothèque ne change pas.</p> : null}</div></div>
      <section className="card"><div className="card-body">
        <WorkoutForm savedBlocks={await listBlockTemplates(actor.userId, wid)} refs={await readAthleteReferences(actor.userId, wid, aid)} wid={wid} aid={aid} athleteName={athlete.displayName} timeZone={athlete.timeZone} cancelHref={back}
          initial={w
            ? { title: w.title, localDate, sport: w.sport, minutes: w.durationSeconds ? String(Math.round(w.durationSeconds / 60)) : '', instructions: w.instructions ?? '', intervals: w.intervals }
            : { title: '', localDate, sport: 'running' satisfies Sport, minutes: '45', instructions: '' }} />
      </div></section>
    </>
  );
}
