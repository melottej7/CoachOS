import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canGiveFeedback, formatDistance, formatDuration, formatLongDate, todayIn, RESULT_STATE_LABELS, SPORT_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteWorkout } from '@/server/repo/athlete';
import { athleteContext, isUuid } from '@/server/repo/context';
import { Notice, Pill } from '@/components/ui';

export const metadata = { title: 'Séance' };

/** X42 : lecture de la version publiée. */
export default async function AthleteWorkoutPage({ params, searchParams }: { params: Promise<{ wid: string; sid: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { wid, sid } = await params;
  const { notice } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx || !isUuid(sid)) notFound();
  const found = await athleteWorkout(actor.userId, wid, ctx.athlete.id, sid);
  if (!found) notFound();
  const { workout: w, feedback } = found;
  const today = todayIn(ctx.athlete.timeZone);
  const open = canGiveFeedback(w.localDate, today, w.canceled);
  const base = `/athlete/${wid}`;
  return (
    <>
      <Link className="back" href={w.localDate === today ? `${base}/today` : `${base}/schedule?week=${w.localDate}`}>← {w.localDate === today ? 'Aujourd’hui' : 'Programme'}</Link>
      <Notice message={notice === 'sent' ? 'Ton retour a été envoyé à ton coach.' : null} />
      <div className="kicker">{formatLongDate(w.localDate)}</div>
      <h1>{w.title}</h1>
      <p className="sub"><Pill>{SPORT_LABELS[w.sport]}</Pill> {w.canceled ? <Pill tone="attn">Annulée</Pill> : null}</p>
      <dl className="details" style={{ marginTop: 16 }}>
        <div><dt>Durée</dt><dd>{formatDuration(w.durationSeconds) ?? 'Libre'}</dd></div>
        {w.distanceM ? <div><dt>Distance</dt><dd>{formatDistance(w.distanceM)}</dd></div> : null}
      </dl>
      <section style={{ marginTop: 20 }} aria-labelledby="consignes">
        <h2 id="consignes">Consignes</h2>
        <p className="prose" style={{ marginTop: 6 }}>{w.instructions || 'Aucune consigne supplémentaire.'}</p>
      </section>
      <section className="card" style={{ marginTop: 24 }} aria-labelledby="mon-retour">
        <div className="card-head"><h2 id="mon-retour">Mon retour</h2>{feedback ? <Pill tone="neutral">Envoyé</Pill> : null}</div>
        <div className="card-body stack">
          {feedback ? (
            <p>
              {RESULT_STATE_LABELS[feedback.state]}
              {feedback.durationSeconds ? ` · ${formatDuration(feedback.durationSeconds)}` : ''}
              {feedback.rpe !== null ? ` · effort ${feedback.rpe}/10` : ''}
              {feedback.reviewedAt ? ' · lu par ton coach' : ''}
            </p>
          ) : null}
          {feedback && feedback.observedRevision !== w.revision ? (
            <p className="banner warn">Ton coach a mis à jour cette séance après ton retour. Ton retour porte sur la version précédente.</p>
          ) : null}
          {open ? (
            <div className="actions">
              <Link className={`btn ${feedback ? '' : 'primary'}`} href={`${base}/workouts/${sid}/feedback`}>{feedback ? 'Corriger mon retour' : 'Donner mon retour'}</Link>
            </div>
          ) : !feedback ? (
            <p className="muted">{w.canceled ? 'Séance annulée : pas de retour attendu.' : 'Tu pourras donner ton retour à partir du jour de la séance.'}</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
