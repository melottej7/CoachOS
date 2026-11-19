import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addDays, canGiveFeedback, effortGap, formatDuration, formatLongDate, formatShortDate, INTENT_LABELS, todayIn, RESULT_STATE_LABELS, sessionIntent, SPORT_LABELS,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteSchedule, nextWorkout } from '@/server/repo/athlete';
import { athleteContext } from '@/server/repo/context';
import { Pill } from '@/components/ui';
import { QuickFeedback } from '@/components/quick-feedback';
import type { AthleteWorkout } from '@/server/repo/athlete';

const GAP_TEXT = { '-1': 'Plus facile que prévu.', '0': 'Ressenti conforme à l’objectif.', '1': 'Plus dur que prévu : ton coach le verra.' } as const;

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
  // CE-C-03 : la séance d’hier sans retour reste proposée en deux gestes.
  const yesterday = addDays(today, -1);
  const pending = (await athleteSchedule(actor.userId, wid, ctx.athlete.id, yesterday, yesterday)).filter((w) => !w.canceled && !w.feedbackState);
  const base = `/athlete/${wid}`;
  const feedbackBlock = (w: AthleteWorkout, when: string) => {
    if (w.canceled || !canGiveFeedback(w.localDate, today, w.canceled)) return null;
    const intent = sessionIntent(w.intervals);
    if (!w.feedbackState) {
      return <QuickFeedback wid={wid} aid={ctx.athlete.id} sid={w.id} revision={w.revision} intent={intent} when={when} detailHref={`${base}/workouts/${w.id}/feedback`} />;
    }
    const gap = effortGap(intent, w.feedbackRpe);
    return (
      <p className="qf-done">
        <Pill tone="neutral">Retour envoyé · {RESULT_STATE_LABELS[w.feedbackState]}</Pill>{' '}
        {gap !== null && intent ? <span>{GAP_TEXT[String(gap) as keyof typeof GAP_TEXT]} <span className="muted">(visé : {INTENT_LABELS[intent]})</span></span> : null}{' '}
        <Link href={`${base}/workouts/${w.id}/feedback`}>Compléter ou modifier</Link>
      </p>
    );
  };
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
            <Link className={`btn${w.feedbackState ? '' : ' primary'}`} href={`${base}/workouts/${w.id}`} data-tour={k === 0 ? 'today-open' : undefined}>Voir la séance</Link>
          </div>
          {feedbackBlock(w, 'd’aujourd’hui')}
        </article>
      )) : (
        <div className="card empty" style={{ marginTop: 14 }} data-tour="today-empty">
          <p><strong>Pas de séance aujourd’hui.</strong> Jour de repos ou programme pas encore publié.</p>
          {next ? <p style={{ marginTop: 8 }}>Prochaine séance : <Link href={`${base}/workouts/${next.id}`}>{next.title}</Link>, {formatShortDate(next.localDate).replace(/\.$/, '')}.</p> : null}
        </div>
      )}
      {pending.map((w) => (
        <article className="athlete-card past" key={w.id}>
          <div className="kicker">Hier · {SPORT_LABELS[w.sport]}</div>
          <h2>{w.title}</h2>
          {feedbackBlock(w, 'd’hier')}
        </article>
      ))}
    </>
  );
}
