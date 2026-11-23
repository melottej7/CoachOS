import Link from 'next/link';
import { goalsAwaitingProgram } from '@/server/commands/programs';
import { addDays, formatDuration, formatShortDate, formatWeekRange, formatWeekday, dayOfMonth, isLocalDate, todayIn, weekDates, weekStart, RESULT_STATE_LABELS, WORKOUT_STATUS_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachWeek, listAssignedAthletes, openReviews } from '@/server/repo/coach';
import { AthleteSelect } from '@/components/nav-link';
import { StatusBadge, initials } from '@/components/ui';
import { WeekTools } from '@/components/week-tools';
import { WeekAdapt } from '@/components/week-adapt';
import { weekProposals } from '@/server/commands/week-proposals';
import { listWeekTemplates } from '@/server/repo/library';

export const metadata = { title: 'Séances' };

/** X18 : semaine de l’athlète sélectionné, dans son fuseau. Brouillon et publié distincts. */
export default async function Calendar({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ athlete?: string; week?: string; notice?: string }> }) {
  const { wid } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const roster = (await listAssignedAthletes(actor.userId, wid)).filter((a) => a.state !== 'archived');
  if (roster.length === 0) {
    return (
      <>
        <h1>Séances</h1>
        <p className="sub">Aucun athlète pour l’instant. Commence par en ajouter un : tu pourras ensuite préparer et publier ses séances.</p>
        <p style={{ marginTop: 16 }}><Link className="btn primary" href={`/coach/${wid}/athletes/new`} data-tour="add-athlete">+ Ajouter un athlète</Link></p>
      </>
    );
  }
  // D-121 : par défaut un élève qui a rejoint l’espace, pas une fiche encore invitée.
  const athlete = roster.find((a) => a.id === sp.athlete) ?? roster.find((a) => a.state === 'active') ?? roster[0]!;
  const today = todayIn(athlete.timeZone);
  const monday = weekStart(sp.week && isLocalDate(sp.week) ? sp.week : today);
  const days = weekDates(monday);
  // Une séance annulée jamais publiée n’a rien à montrer ; annulée après publication, elle attend la republication (D-063).
  const workouts = (await coachWeek(actor.userId, wid, athlete.id, days[0]!, days[6]!)).filter((w) => !(w.canceled && w.publishedRevision === null));
  const reviews = await openReviews(actor.userId, wid, athlete.id);
  const base = `/coach/${wid}`;
  const weekHref = (m: string) => `${base}/calendar?athlete=${athlete.id}&week=${m}`;
  const tourDay = days.includes(today) ? today : days[0];
  const newHref = (d: string) => `${base}/athletes/${athlete.id}/workouts/new?date=${d}`;
  const first = athlete.displayName.split(' ')[0];
  const weekTemplates = await listWeekTemplates(actor.userId, wid);
  const drafts = workouts.filter((w) => w.status !== 'published');
  const adapt = athlete.state === 'active' ? await weekProposals(actor.userId, wid, athlete.id, monday) : null;
  const awaiting = await goalsAwaitingProgram(actor.userId, wid, athlete.id);

  return (
    <>
      <div className="head">
        <div>
          <div className="kicker">{formatWeekRange(monday)} · {athlete.timeZone}</div>
          <h1>Séances</h1>
          <p className="sub">Préparer les séances de {athlete.displayName}, puis publier ce qui doit être lu.</p>
        </div>
        <Link className="btn primary" href={newHref(today >= days[0]! && today <= days[6]! ? today : days[0]!)}>+ Nouvelle séance</Link>
      </div>
      {awaiting.map((g) => (
        <div key={g.id} className="banner next-step" role="status">
          <span><strong>Prochaine étape :</strong> l’objectif « {g.title} » est validé. Génère le programme qui permet de l’atteindre (tu relis les risques, rien n’est publié).</span>
          <Link className="btn primary small" href={`/coach/${wid}/athletes/${athlete.id}/programme?objectif=${g.id}`}>📅 Générer le programme</Link>
        </div>
      ))}
      {sp.notice === 'program' ? <p className="banner ok" role="status">Programme créé en brouillons, semaine par semaine. Relis, ajuste, puis « Publier la semaine » quand tout te convient.</p> : null}
      {sp.notice === 'regenerated' ? <p className="banner ok" role="status">Semaines régénérées en brouillons. Les séances déjà publiées et modifiées attendent ta republication (« Publier la semaine »).</p> : null}

      <section className="card" aria-labelledby="week-title">
        <div className="card-head">
          <h2 id="week-title">Semaine du {formatShortDate(monday)}</h2>
          <div className="week-nav">
            <AthleteSelect wid={wid} week={monday} selected={athlete.id} athletes={roster.map((a) => ({ id: a.id, name: a.displayName + (a.state === 'invited' ? ' (invité·e)' : '') }))} />
            <Link className="btn" href={weekHref(addDays(monday, -7))} aria-label="Semaine précédente">←</Link>
            <Link className="btn" href={weekHref(weekStart(today))}>Cette semaine</Link>
            <Link className="btn" href={weekHref(addDays(monday, 7))} aria-label="Semaine suivante">→</Link>
          </div>
        </div>
        <ol className="week">
          {days.map((d) => {
            const items = workouts.filter((w) => w.localDate === d);
            return (
              <li key={d} className={`day ${d === today ? 'today' : ''}`} aria-current={d === today ? 'date' : undefined}>
                <h3>{formatWeekday(d)} {dayOfMonth(d)}{d === today ? ' · aujourd’hui' : ''}</h3>
                {items.length ? (
                  <ul>
                    {items.map((w) => (
                      <li key={w.id}>
                        <Link className={`session ${w.status}${w.canceled ? ' canceled' : ''}`} href={`${base}/athletes/${athlete.id}/workouts/${w.id}`}>
                          <strong>{w.title}</strong>
                          <small>{w.canceled
                            ? (w.status === 'published' ? 'Annulée' : 'Annulée · à republier')
                            : [formatDuration(w.durationSeconds), WORKOUT_STATUS_LABELS[w.status]].filter(Boolean).join(' · ')}</small>
                          {w.feedback ? <small>{RESULT_STATE_LABELS[w.feedback.state]}{w.feedback.reviewed ? ' · traité' : ' · retour à traiter'}</small> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link className="link-btn add" href={newHref(d)} aria-label={`Ajouter une séance le ${formatShortDate(d)}`} data-tour={d === tourDay ? 'day-add' : undefined}>+ Ajouter</Link>
              </li>
            );
          })}
        </ol>
        <WeekTools wid={wid} athleteId={athlete.id} first={first ?? athlete.displayName} monday={monday} hasSessions={workouts.some((w) => !w.canceled)}
          drafts={drafts.map((w) => ({ id: w.id, revision: w.workingRevision, title: w.title, localDate: w.localDate, changed: w.status === 'changed' }))}
          templates={weekTemplates.map((t) => ({ id: t.id, title: t.title, weeks: t.weeks, days: t.days.map((d) => ({ offset: d.offset, title: d.workout.title })) }))} />
        {adapt && adapt.sessions.length ? (
          <WeekAdapt wid={wid} aid={athlete.id} monday={monday} first={first ?? athlete.displayName} proposals={adapt.proposals}
            seen={adapt.sessions.map((x) => ({ id: x.id, revision: x.revision }))} />
        ) : null}
      </section>

      <section className="card" aria-labelledby="reviews-title">
        <div className="card-head">
          <h2 id="reviews-title">Retours de {first} à traiter</h2>
          <Link className="link-btn" href={`${base}/review`}>Tous les retours →</Link>
        </div>
        {reviews.length ? reviews.map((r) => (
          <div className="row" key={r.id}>
            <span className="avatar" aria-hidden="true">{initials(r.athleteName)}</span>
            <div className="row-text">
              <h3>{r.title ?? 'Séance indisponible'}</h3>
              <p>{r.localDate ? formatShortDate(r.localDate) : ''} · {r.resultState ? RESULT_STATE_LABELS[r.resultState] : ''}{r.rpe !== null ? ` · Effort ${r.rpe}/10` : ''}{r.hasComment ? ' · commentaire' : ''}</p>
            </div>
            <Link className="btn" href={`${base}/review/${r.id}?from=calendar`}>Ouvrir le retour</Link>
          </div>
        )) : <p className="empty">Aucun retour à traiter pour {first}.</p>}
      </section>
      <p className="muted" style={{ marginTop: 12 }}><StatusBadge status="draft" /> invisible pour l’athlète · <StatusBadge status="published" /> visible · <StatusBadge status="changed" /> l’athlète lit encore la version publiée</p>
    </>
  );
}
