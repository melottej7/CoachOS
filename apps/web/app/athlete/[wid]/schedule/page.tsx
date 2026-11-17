import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, dayOfMonth, formatDuration, formatWeekRange, formatWeekday, isLocalDate, todayIn, weekDates, weekStart, SPORT_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteSchedule } from '@/server/repo/athlete';
import { athleteContext } from '@/server/repo/context';

export const metadata = { title: 'Programme' };

/** X41 : séances publiées de la semaine. Les brouillons du coach n’apparaissent jamais. */
export default async function Schedule({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ week?: string }> }) {
  const { wid } = await params;
  const { week } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const today = todayIn(ctx.athlete.timeZone);
  const monday = weekStart(week && isLocalDate(week) ? week : today);
  const days = weekDates(monday);
  const items = await athleteSchedule(actor.userId, wid, ctx.athlete.id, days[0]!, days[6]!);
  const base = `/athlete/${wid}`;
  return (
    <>
      <div className="kicker">{formatWeekRange(monday)}</div>
      <h1>Programme</h1>
      <div className="actions" style={{ margin: '12px 0' }}>
        <Link className="btn" href={`${base}/schedule?week=${addDays(monday, -7)}`} aria-label="Semaine précédente">←</Link>
        <Link className="btn" href={`${base}/schedule`}>Cette semaine</Link>
        <Link className="btn" href={`${base}/schedule?week=${addDays(monday, 7)}`} aria-label="Semaine suivante">→</Link>
      </div>
      <section className="card" aria-label="Séances publiées">
        {items.length ? items.map((w) => (
          <div className="row" key={w.id}>
            <div className="date-cell"><strong>{dayOfMonth(w.localDate)}</strong>{formatWeekday(w.localDate)}</div>
            <div className="row-text">
              <h3>{w.title}{w.localDate === today ? ' · aujourd’hui' : ''}</h3>
              <p>{SPORT_LABELS[w.sport]}{formatDuration(w.durationSeconds) ? ` · ${formatDuration(w.durationSeconds)}` : ''}{w.feedbackState ? ' · Retour envoyé' : ''}{w.canceled ? ' · Annulée' : ''}</p>
            </div>
            <Link className="btn" href={`${base}/workouts/${w.id}`} aria-label={`Voir ${w.title}`}>Voir</Link>
          </div>
        )) : <p className="empty">Aucune séance publiée cette semaine.</p>}
      </section>
    </>
  );
}
