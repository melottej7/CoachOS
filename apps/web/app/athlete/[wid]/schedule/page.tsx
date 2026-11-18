import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addDays, addMonths, dayOfMonth, formatDuration, formatMonth, formatWeekRange, formatWeekday, isLocalDate, monthStart, monthWeeks,
  todayIn, weekDates, weekStart, SPORT_LABELS,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteSchedule, type AthleteWorkout } from '@/server/repo/athlete';
import { athleteContext } from '@/server/repo/context';

export const metadata = { title: 'Programme' };

const DAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

function status(w: AthleteWorkout): string {
  if (w.canceled) return 'Annulée';
  if (w.feedbackState) return 'Retour envoyé';
  return '';
}

/** X41 : séances publiées, par semaine ou par mois. Les brouillons du coach n’apparaissent jamais. */
export default async function Schedule({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ week?: string; month?: string; view?: string }> }) {
  const { wid } = await params;
  const { week, month, view } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const today = todayIn(ctx.athlete.timeZone);
  const base = `/athlete/${wid}`;
  const isMonth = view === 'month';

  const toggle = (
    <nav className="seg-tabs" aria-label="Affichage du programme">
      <Link href={`${base}/schedule`} aria-current={!isMonth ? 'page' : undefined}>Semaine</Link>
      <Link href={`${base}/schedule?view=month`} aria-current={isMonth ? 'page' : undefined}>Mois</Link>
    </nav>
  );

  if (isMonth) {
    const first = monthStart(month && isLocalDate(`${month}-01`) ? `${month}-01` : today);
    const weeks = monthWeeks(first);
    const items = await athleteSchedule(actor.userId, wid, ctx.athlete.id, weeks[0]!, addDays(weeks.at(-1)!, 6));
    const byDay = new Map<string, AthleteWorkout[]>();
    for (const w of items) byDay.set(w.localDate, [...(byDay.get(w.localDate) ?? []), w]);
    const ym = (d: string) => d.slice(0, 7);
    return (
      <>
        <div className="kicker">{formatMonth(first)}</div>
        <h1>Programme</h1>
        {toggle}
        <div className="actions" style={{ margin: '12px 0' }}>
          <Link className="btn" href={`${base}/schedule?view=month&month=${ym(addMonths(first, -1))}`} aria-label="Mois précédent">←</Link>
          <Link className="btn" href={`${base}/schedule?view=month`}>Ce mois-ci</Link>
          <Link className="btn" href={`${base}/schedule?view=month&month=${ym(addMonths(first, 1))}`} aria-label="Mois suivant">→</Link>
        </div>
        <section className="card month" aria-label={`Séances publiées en ${formatMonth(first)}`}>
          <div className="month-head" aria-hidden="true">{DAYS.map((d) => <span key={d}>{d}</span>)}<span>Total</span></div>
          {weeks.map((monday) => {
            const days = weekDates(monday);
            const list = days.flatMap((d) => byDay.get(d) ?? []).filter((w) => !w.canceled);
            const seconds = list.reduce((n, w) => n + (w.durationSeconds ?? 0), 0);
            const sent = list.filter((w) => w.feedbackState).length;
            return (
              <div className="month-week" key={monday}>
                {days.map((d) => {
                  const ws = byDay.get(d) ?? [];
                  const out = ym(d) !== ym(first);
                  const label = `${formatWeekday(d)} ${dayOfMonth(d)}${ws.length ? ` : ${ws.map((w) => `${w.title}${status(w) ? ` (${status(w).toLowerCase()})` : ''}`).join(', ')}` : ', repos'}`;
                  return (
                    <Link key={d} href={ws.length === 1 ? `${base}/workouts/${ws[0]!.id}` : `${base}/schedule?week=${monday}`}
                      className={`month-day${out ? ' out' : ''}${d === today ? ' today' : ''}${ws.length ? ' has' : ''}`} aria-label={label}>
                      <span className="month-num">{dayOfMonth(d)}</span>
                      {ws.map((w) => (
                        <span key={w.id} className={`month-item${w.feedbackState ? ' done' : ''}${w.canceled ? ' canceled' : ''}`}>
                          <span className="month-dot" aria-hidden="true">{w.feedbackState ? '✓' : ''}</span>
                          <span className="month-title">{w.title}</span>
                        </span>
                      ))}
                    </Link>
                  );
                })}
                <div className="month-total">
                  <strong>{seconds ? formatDuration(seconds) : '—'}</strong>
                  <span>{list.length ? `${sent}/${list.length} retour${list.length > 1 ? 's' : ''}` : 'repos'}</span>
                </div>
              </div>
            );
          })}
        </section>
        <p className="muted" style={{ marginTop: 10 }}>✓ retour envoyé. Touche un jour pour ouvrir la séance ou la semaine.</p>
      </>
    );
  }

  const monday = weekStart(week && isLocalDate(week) ? week : today);
  const days = weekDates(monday);
  const items = await athleteSchedule(actor.userId, wid, ctx.athlete.id, days[0]!, days[6]!);
  return (
    <>
      <div className="kicker">{formatWeekRange(monday)}</div>
      <h1>Programme</h1>
      {toggle}
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
              <p>{SPORT_LABELS[w.sport]}{formatDuration(w.durationSeconds) ? ` · ${formatDuration(w.durationSeconds)}` : ''}{status(w) ? ` · ${status(w)}` : ''}</p>
            </div>
            <Link className="btn" href={`${base}/workouts/${w.id}`} aria-label={`Voir ${w.title}`}>Voir</Link>
          </div>
        )) : <p className="empty">Aucune séance publiée cette semaine.</p>}
      </section>
    </>
  );
}
