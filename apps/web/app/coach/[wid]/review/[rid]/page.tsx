import Link from 'next/link';
import { notFound } from 'next/navigation';
import { matchesReviewFilter, parseReviewFilter, reviewFilterQuery, snoozeChoices, todayIn, CHANGE_LABELS, describeBlock, DIFFICULTY_LABELS, FEELING_LABELS, READINESS_LABELS, READINESS_QUESTION, readinessAlert, formatDistance, formatPace, formatDuration, formatLongDate, formatShortDate, weekStart, RESULT_STATE_LABELS, SPORT_LABELS, testDistanceOf, vmaFromRace, formatDuration2 } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachWorkout, openReviews, reviewItem, revisionByNumber } from '@/server/repo/coach';
import { MarkReviewedButton } from '@/components/review-button';
import { ReviewSnooze } from '@/components/review-snooze';
import { coachContext } from '@/server/repo/context';
import { Notice, Pill } from '@/components/ui';
import { StructureView } from '@/components/structure-view';
import { QuickReply } from '@/components/messaging';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { TestResultActions } from '@/components/test-result';


export const metadata = { title: 'Retour' };

/** X11/X17 : prévu (version observée) contre réalisé, puis traitement. Le contexte d’origine est conservé. */
export default async function ReviewDetail({ params, searchParams }: { params: Promise<{ wid: string; rid: string }>; searchParams: Promise<{ from?: string; notice?: string; eleve?: string; groupe?: string; seulement?: string }> }) {
  const { wid, rid } = await params;
  const sp = await searchParams;
  const { from, notice } = sp;
  // C09-08 (D-082) : le filtre de la file reste actif au retour du détail et pour le retour suivant.
  const filter = parseReviewFilter(sp);
  const fq = reviewFilterQuery(filter);
  const keep = (extra: string) => { const s = [fq.slice(1), extra].filter(Boolean).join('&'); return s ? `?${s}` : ''; };
  const actor = await requireActor();
  const item = await reviewItem(actor.userId, wid, rid);
  if (!item) notFound();
  const base = `/coach/${wid}`;
  const w = item.workoutId ? await coachWorkout(actor.userId, wid, item.athleteId, item.workoutId) : null;
  const first = item.athleteName.split(' ')[0];
  const queueHref = `${base}/review${fq}`;
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
  const next = (await openReviews(actor.userId, wid)).find((r) => r.id !== rid && matchesReviewFilter(r, filter));
  const after = `${base}/review/${rid}${keep(`notice=reviewed${from ? `&from=${from}` : ''}`)}`;
  const ctx = await coachContext(actor.userId, wid);
  const tz = ctx?.workspace.timeZone ?? w.athlete.timeZone;
  const snoozeAfter = from === 'calendar' ? calendarHref : `${base}/review${keep('notice=snoozed')}`;
  const done = fb.reviewedAt !== null;
  // D-090 : résultat d’un test (« Test 5 km »).
  const testMeters = observed ? testDistanceOf(observed.title, observed.intervals) : null;
  const test = testMeters && fb.testSeconds && (fb.state === 'completed' || fb.state === 'partial')
    ? { meters: testMeters, seconds: fb.testSeconds, vma: observed && (observed.sport === 'running' || observed.sport === 'trail') ? vmaFromRace(testMeters, fb.testSeconds) : null } : null;

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

      {test && observed ? (
        <section className="card" aria-labelledby="test-title">
          <div className="card-head"><h2 id="test-title">Résultat du test</h2><span className="muted">Saisi par {first}</span></div>
          <div className="card-body stack">
            <p><strong>{formatDuration2(test.seconds)}</strong> sur {formatDistance(test.meters)} · {formatPace(Math.round(test.seconds / (test.meters / 1000)))}
              {test.vma ? <> · VMA estimée <strong>{String(test.vma).replace('.', ',')} km/h</strong>{refs?.vmaKmh ? <span className="muted"> (actuelle : {String(refs.vmaKmh).replace('.', ',')} km/h)</span> : <span className="muted"> (aucune VMA renseignée)</span>}</> : null}</p>
            {test.vma ? <p className="muted">Estimation : sur un test de cette durée, on tient environ {Math.round((test.meters / test.seconds) * 3.6 / test.vma * 100)} % de sa VMA. Les zones et les allures de {first} suivent la VMA que tu choisis.</p> : null}
            <TestResultActions wid={wid} aid={item.athleteId} sport={observed.sport} name={observed.title} meters={test.meters} seconds={test.seconds}
              doneOn={observed.localDate} vmaKmh={test.vma} currentVma={refs?.vmaKmh ?? null} />
          </div>
        </section>
      ) : null}

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
              {fb.durationSeconds || fb.distanceM ? <div><dt>Provenance</dt><dd>{fb.measureFile
                ? (fb.activities.length > 1 ? `Additionnée de ${fb.activities.length} activités de sa montre` : `Lue dans un fichier ${fb.measureFile.toUpperCase()} de sa montre`)
                : fb.activities.length ? 'Saisie à la main (activités de la montre jointes)' : 'Saisie à la main'}</dd></div> : null}
              {fb.activities.length ? (
                <div><dt>Activités</dt><dd><ul className="plain">{fb.activities.map((a, i) => {
                  const t = a.startedAt ? new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: w.athlete.timeZone }).format(new Date(a.startedAt)) : null;
                  return <li key={i}>{[a.sport ? SPORT_LABELS[a.sport] : null, formatDuration(a.seconds), a.distanceM ? formatDistance(a.distanceM) : null, t].filter(Boolean).join(' · ')}</li>;
                })}</ul></dd></div>
              ) : null}
              {fb.distanceM && fb.durationSeconds ? <div><dt>Allure moyenne</dt><dd>{formatPace(Math.round(fb.durationSeconds / (fb.distanceM / 1000)))}</dd></div> : null}
              <div><dt>Effort ressenti</dt><dd>{fb.rpe !== null ? `${fb.rpe}/10` : 'Non renseigné'}</dd></div>
              {fb.readiness ? <div><dt>{READINESS_QUESTION}</dt><dd>{readinessAlert(fb.readiness)
                ? <><span className="pill attn">{READINESS_LABELS[fb.readiness]}</span> <span className="muted">Parles-en avec l’élève (message ou de vive voix) avant d’ajuster la suite.</span></>
                : READINESS_LABELS[fb.readiness]}</dd></div> : null}
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
          <QuickReply wid={wid} athleteId={item.athleteId} first={first ?? item.athleteName} workoutId={w.id} />
          {done ? (
            <p>Traité le {new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long', timeStyle: 'short', timeZone: w.athlete.timeZone }).format(new Date(fb.reviewedAt!))}.</p>
          ) : (
            <>
              <p className="muted">Marquer comme traité ferme ce cas dans la file. Aucun message n’est envoyé à {first}.</p>
              <MarkReviewedButton wid={wid} aid={item.athleteId} sid={w.id} expectedRevision={fb.revision} after={after} />
              {item.snoozedUntil ? <p className="muted">Reporté : il reviendra dans la file à la date choisie.</p>
                : <ReviewSnooze wid={wid} rid={rid} choices={snoozeChoices(todayIn(tz), tz)} after={snoozeAfter} />}
            </>
          )}
          <div className="actions">
            {next ? <Link className="btn" href={`${base}/review/${next.id}${keep(from ? `from=${from}` : '')}`}>Retour suivant · {next.athleteName.split(' ')[0]}</Link> : null}
            <Link className="link-btn" href={`${base}/athletes/${item.athleteId}/workouts/${w.id}`}>Voir la séance</Link>
          </div>
        </div>
      </section>
    </>
  );
}
