import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CHANGE_LABELS, describeBlock, DIFFICULTY_LABELS, FEELING_LABELS, formatDistance, formatPace, formatDuration, formatLongDate, formatShortDate, weekStart, RESULT_STATE_LABELS, SPORT_LABELS } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachWorkout, openReviews, reviewItem, revisionByNumber } from '@/server/repo/coach';
import { MarkReviewedButton } from '@/components/review-button';
import { Notice, Pill } from '@/components/ui';
import { StructureView } from '@/components/structure-view';
import { readAthleteReferences } from '@/server/commands/athlete-references';


export const metadata = { title: 'Retour' };

/** X11/X17 : prévu (version observée) contre réalisé, puis traitement. Le contexte d’origine est conservé. */
export default async function ReviewDetail({ params, searchParams }: { params: Promise<{ wid: string; rid: string }>; searchParams: Promise<{ from?: string; notice?: string }> }) {
  const { wid, rid } = await params;
  const { from, notice } = await searchParams;
  const actor = await requireActor();
  const item = await reviewItem(actor.userId, wid, rid);
  if (!item) notFound();
  const base = `/coach/${wid}`;
  const w = item.workoutId ? await coachWorkout(actor.userId, wid, item.athleteId, item.workoutId) : null;
  const first = item.athleteName.split(' ')[0];
  const queueHref = `${base}/review`;
  const calendarHref = w ? `${base}/calendar?athlete=${item.athleteId}&week=${weekStart(w.working.localDate)}` : queueHref;
  const backHref = from === 'calendar' ? calendarHref : queueHref;
  const backLabel = from === 'calendar' ? `← Séances de ${item.athleteName}` : '← Retours';

  if (!w || !w.feedback) {
    // C09-04 : expliquer l’indisponibilité plutôt qu’un écran vide.
    return (
      <>
        <Link className="back" href={backHref}>{backLabel}</Link>
        <h1>Retour indisponible</h1>
        <p className="sub">La séance ou le retour source n’est plus accessible (dossier archivé, affectation retirée ou donnée effacée).</p>
      </>
    );
  }
  const fb = w.feedback;
  const refs = await readAthleteReferences(actor.userId, wid, item.athleteId);
  const observed = await revisionByNumber(actor.userId, wid, item.athleteId, w.id, fb.observedRevision);
  const current = w.published;
  const next = (await openReviews(actor.userId, wid)).find((r) => r.id !== rid);
  const after = `${base}/review/${rid}?notice=reviewed${from ? `&from=${from}` : ''}`;
  const done = fb.reviewedAt !== null;

  return (
    <>
      <Link className="back" href={backHref}>{backLabel}</Link>
      <Notice message={notice === 'reviewed' && done ? 'Retour marqué comme traité.' : null} />
      <div className="head">
        <div>
          <div className="kicker">{item.athleteName} · {observed ? formatLongDate(observed.localDate) : ''}</div>
          <h1>Retour de {first}</h1>
          <p className="sub">
            {done ? <Pill>Traité</Pill> : <Pill tone="attn">À traiter</Pill>} Envoyé le {formatShortDate(fb.createdAt.slice(0, 10))}
            {fb.revision > 1 ? ` · corrigé par l’athlète (version ${fb.revision} du retour)` : ''}
          </p>
        </div>
      </div>

      <div className="compare">
        <section className="card" aria-labelledby="planned">
          <div className="card-head"><h2 id="planned">Prévu</h2><Pill tone="neutral">Version {fb.observedRevision} vue par {first}</Pill></div>
          <div className="card-body stack">
            {observed ? (
              <>
                <h3>{observed.title}</h3>
                <dl className="details">
                  <div><dt>Sport</dt><dd>{SPORT_LABELS[observed.sport]}</dd></div>
                  <div><dt>Durée</dt><dd>{formatDuration(observed.durationSeconds) ?? 'Non précisée'}</dd></div>
                  {observed.distanceM ? <div><dt>Distance</dt><dd>{formatDistance(observed.distanceM)}</dd></div> : null}
                </dl>
                <StructureView blocks={observed.intervals} sport={observed.sport} refs={refs} />
                {observed.instructions ? <p className="prose">{observed.instructions}</p> : null}
              </>
            ) : <p>Version observée indisponible.</p>}
            {current && current.number !== fb.observedRevision ? (
              <p className="banner warn">Depuis ce retour, la version {current.number} a été publiée. Ce retour porte sur la version {fb.observedRevision}.</p>
            ) : null}
          </div>
        </section>
        <section className="card" aria-labelledby="done" style={{ marginTop: 0 }}>
          <div className="card-head"><h2 id="done">Déclaré par {first}</h2></div>
          <div className="card-body stack">
            <dl className="details">
              <div><dt>Réalisation</dt><dd>{RESULT_STATE_LABELS[fb.state]}</dd></div>
              <div><dt>Durée réalisée</dt><dd>{formatDuration(fb.durationSeconds) ?? 'Non renseignée'}</dd></div>
              {fb.distanceM ? <div><dt>Distance</dt><dd>{formatDistance(fb.distanceM)}</dd></div> : null}
              {fb.distanceM && fb.durationSeconds ? <div><dt>Allure moyenne</dt><dd>{formatPace(Math.round(fb.durationSeconds / (fb.distanceM / 1000)))}</dd></div> : null}
              <div><dt>Effort ressenti</dt><dd>{fb.rpe !== null ? `${fb.rpe}/10` : 'Non renseigné'}</dd></div>
              <div><dt>Ressenti général</dt><dd>{fb.overallFeeling ? FEELING_LABELS[fb.overallFeeling as 1 | 2 | 3 | 4 | 5] : 'Non renseigné'}</dd></div>
              {fb.difficulties.length ? <div><dt>Difficultés</dt><dd>{fb.difficulties.map((d) => DIFFICULTY_LABELS[d]).join(', ')}</dd></div> : null}
            </dl>
            {fb.changes.length || fb.actualSport || fb.repeatsDone.length ? (
              <div className="changed-view">
                <h3>Ce qui a changé</h3>
                {fb.changes.length ? <p>{fb.changes.map((c) => CHANGE_LABELS[c]).join(' · ')}</p> : null}
                {fb.actualSport ? <p>Sport pratiqué : <strong>{SPORT_LABELS[fb.actualSport]}</strong></p> : null}
                {fb.repeatsDone.length && observed ? (
                  <ul className="reps-done">
                    {observed.intervals.filter((b) => b.type === 'repeat').map((r, i) => {
                      const doneN = fb.repeatsDone[i];
                      if (doneN === undefined || r.type !== 'repeat') return null;
                      return <li key={i}><span>{describeBlock(r, observed.sport)}</span> <strong className={doneN < r.times ? 'short' : ''}>{doneN} sur {r.times}</strong></li>;
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div>
              <h3>Commentaire</h3>
              <p className="prose">{fb.comment ?? 'Pas de commentaire.'}</p>
            </div>
          </div>
        </section>
      </div>

      <section className="card" aria-label="Traitement">
        <div className="card-body stack">
          {done ? (
            <p>Traité le {new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long', timeStyle: 'short', timeZone: w.athlete.timeZone }).format(new Date(fb.reviewedAt!))}.</p>
          ) : (
            <>
              <p className="muted">Marquer comme traité ferme ce cas dans la file. Aucun message n’est envoyé à {first}.</p>
              <MarkReviewedButton wid={wid} aid={item.athleteId} sid={w.id} expectedRevision={fb.revision} after={after} />
            </>
          )}
          <div className="actions">
            {next ? <Link className="btn" href={`${base}/review/${next.id}${from ? `?from=${from}` : ''}`}>Retour suivant · {next.athleteName.split(' ')[0]}</Link> : null}
            <Link className="link-btn" href={`${base}/athletes/${item.athleteId}/workouts/${w.id}`}>Voir la séance</Link>
          </div>
        </div>
      </section>
    </>
  );
}
