import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDuration, formatLongDate, formatShortDate, todayIn, RESULT_STATE_LABELS, SPORT_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteSchedule, nextWorkout } from '@/server/repo/athlete';
import { athleteContext } from '@/server/repo/context';
import { Pill } from '@/components/ui';

export const metadata = { title: 'Aujourd’hui' };

/** X40 : le prochain geste utile. Séance du jour en une action, sinon la prochaine. */
export default async function Today({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { wid } = await params;
  const { notice } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const today = todayIn(ctx.athlete.timeZone);
  const todays = await athleteSchedule(actor.userId, wid, ctx.athlete.id, today, today);
  const next = todays.length ? null : await nextWorkout(actor.userId, wid, ctx.athlete.id, today);
  const base = `/athlete/${wid}`;
  return (
    <>
      {notice === 'joined' ? <p className="banner ok" role="status" style={{ marginBottom: 16 }}>Bienvenue dans {ctx.workspace.name}. Tes séances publiées apparaissent ici et dans Programme.</p> : null}
      <div className="kicker">{formatLongDate(today)} · {ctx.athlete.timeZone}</div>
      <h1>Aujourd’hui</h1>
      {todays.length ? todays.map((w, k) => (
        <article className="athlete-card" key={w.id} data-tour={k === 0 ? 'today-card' : undefined}>
          <Pill>{SPORT_LABELS[w.sport]}</Pill> {w.canceled ? <Pill tone="attn">Annulée</Pill> : null}
          <h2>{w.title}</h2>
          <p className="sub">{formatDuration(w.durationSeconds) ?? 'Durée libre'}</p>
          <div className="actions">
            <Link className="btn primary" href={`${base}/workouts/${w.id}`} data-tour={k === 0 ? 'today-open' : undefined}>Voir la séance</Link>
            {w.feedbackState ? <Pill tone="neutral">Retour envoyé · {RESULT_STATE_LABELS[w.feedbackState]}</Pill> : null}
          </div>
        </article>
      )) : (
        <div className="card empty" style={{ marginTop: 14 }} data-tour="today-empty">
          <p><strong>Pas de séance aujourd’hui.</strong> Jour de repos ou programme pas encore publié.</p>
          {next ? <p style={{ marginTop: 8 }}>Prochaine séance : <Link href={`${base}/workouts/${next.id}`}>{next.title}</Link>, {formatShortDate(next.localDate).replace(/\.$/, '')}.</p> : null}
        </div>
      )}
    </>
  );
}
