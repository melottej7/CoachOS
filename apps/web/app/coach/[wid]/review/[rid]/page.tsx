import { notFound } from 'next/navigation';
import {
  matchesReviewFilter, parseReviewFilter, reviewFilterQuery, snoozeChoices, todayIn, CHANGE_LABELS, describeBlock, DIFFICULTY_LABELS, FEELING_LABELS,
  READINESS_LABELS, READINESS_QUESTION, readinessAlert, formatDistance, formatPace, formatDuration, formatLongDate, formatShortDate, weekStart,
  RESULT_STATE_LABELS, sessionView, SPORT_LABELS, testDistanceOf, vmaFromRace, formatDuration2, strengthPlan,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachWorkout, openReviews, reviewItem, revisionByNumber } from '@/server/repo/coach';
import { coachContext } from '@/server/repo/context';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import {
  Badge, Banner, Card, Cluster, EmptyState, Eyebrow, Facts, Heading, LinkButton, SessionRows, SessionStats, SessionStrip, Stack, Text, type Fact,
} from '@/design';
import { StrengthLog } from '@/views/athlete/strength-log';
import { MarkReviewed, QuickReply, ReviewKeys, SnoozeReview, TestResultActions } from '@/views/coach/review-actions';
import s from '@/views/coach/review/review.module.css';
import { AthleteLink } from '@/views/coach/athlete-link';

export const metadata = { title: 'Retour' };

/**
 * X11/X17, refonte Chrono (D-145) : prévu (version observée) face au réalisé, puis traitement ; au clavier (T, R, J).
 * Le contexte d’origine (file filtrée ou calendrier) est conservé.
 */
export default async function ReviewDetail({ params, searchParams }: { params: Promise<{ wid: string; rid: string }>; searchParams: Promise<{ from?: string; notice?: string; eleve?: string; groupe?: string; seulement?: string }> }) {
  const { wid, rid } = await params;
  const sp = await searchParams;
  const { from, notice } = sp;
  // C09-08 (D-082) : le filtre de la file reste actif au retour du détail et pour le retour suivant.
  const filter = parseReviewFilter(sp);
  const fq = reviewFilterQuery(filter);
  const keep = (extra: string) => { const x = [fq.slice(1), extra].filter(Boolean).join('&'); return x ? `?${x}` : ''; };
  const actor = await requireActor();
  const [item, ctx] = await Promise.all([reviewItem(actor.userId, wid, rid), coachContext(actor.userId, wid)]);
  if (!item || !ctx) notFound();
  const base = `/coach/${wid}`;
  const w = item.workoutId ? await coachWorkout(actor.userId, wid, item.athleteId, item.workoutId) : null;
  const first = item.athleteName.split(' ')[0] ?? item.athleteName;
  const queueHref = `${base}/review${fq}`;
  const calendarHref = w ? `${base}/calendar?athlete=${item.athleteId}&week=${weekStart(w.working.localDate)}` : queueHref;
  const back = from === 'calendar' ? { href: calendarHref, label: `Séances de ${item.athleteName}` } : { href: queueHref, label: 'Retours' };

  if (!w || !w.feedback) {
    // C09-04 : expliquer l’indisponibilité plutôt qu’un écran vide.
    return (
      <Stack gap={6}>
        <Cluster><LinkButton href={back.href} variant="ghost" size="sm" icon="chevronLeft">{back.label}</LinkButton></Cluster>
        <EmptyState icon="alert" title="Retour indisponible">La séance ou le retour source n’est plus accessible (dossier archivé, affectation retirée ou donnée effacée).</EmptyState>
      </Stack>
    );
  }
  const fb = w.feedback;
  const [refs, observed, queue] = await Promise.all([
    readAthleteReferences(actor.userId, wid, item.athleteId),
    revisionByNumber(actor.userId, wid, item.athleteId, w.id, fb.observedRevision),
    openReviews(actor.userId, wid),
  ]);
  const current = w.published;
  const next = queue.find((r) => r.id !== rid && matchesReviewFilter(r, filter));
  // Bilan produit (fluidité) : depuis la file, « Marquer comme traité » enchaîne sur le retour suivant (un toucher de moins).
  const after = next && from !== 'calendar'
    ? `${base}/review/${next.id}${keep('notice=enchaine')}`
    : `${base}/review/${rid}${keep(`notice=reviewed${from ? `&from=${from}` : ''}`)}`;
  const tz = ctx.workspace.timeZone;
  // D-202 : après une réponse, le retour est traité ; on enchaîne sur le suivant comme après « Marquer comme traité ».
  const afterReply = next && from !== 'calendar'
    ? `${base}/review/${next.id}${keep('notice=repondu-suivant')}`
    : `${base}/review/${rid}${keep(`notice=repondu${from ? `&from=${from}` : ''}`)}`;
  const snoozeAfter = from === 'calendar' ? calendarHref : `${base}/review${keep('notice=snoozed')}`;
  const done = fb.reviewedAt !== null;
  const view = observed ? sessionView(observed.intervals, observed.sport, refs, observed.durationSeconds) : null;
  // D-090 : résultat d’un test (« Test 5 km »).
  const testMeters = observed ? testDistanceOf(observed.title, observed.intervals) : null;
  const test = testMeters && fb.testSeconds && (fb.state === 'completed' || fb.state === 'partial')
    ? { meters: testMeters, seconds: fb.testSeconds, vma: observed && (observed.sport === 'running' || observed.sport === 'trail') ? vmaFromRace(testMeters, fb.testSeconds) : null } : null;
  const kmh = (v: number) => `${String(v).replace('.', ',')} km/h`;

  const facts: Fact[] = [
    { label: 'Réalisation', value: RESULT_STATE_LABELS[fb.state] },
    { label: 'Durée réalisée', value: formatDuration(fb.durationSeconds) ?? 'Non renseignée' },
    ...(fb.distanceM ? [{ label: 'Distance', value: formatDistance(fb.distanceM) }] : []),
    ...(fb.durationSeconds || fb.distanceM ? [{
      label: 'Provenance', value: fb.measureFile
        ? (fb.activities.length > 1 ? `Additionnée de ${fb.activities.length} activités de sa montre` : `Lue dans un fichier ${fb.measureFile.toUpperCase()} de sa montre`)
        : fb.activities.length ? 'Saisie à la main (activités de la montre jointes)' : 'Saisie à la main',
    }] : []),
    ...(fb.activities.length ? [{
      label: 'Activités', value: (
        <Stack as="ul" gap={1}>{fb.activities.map((a, i) => {
          const t = a.startedAt ? new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: w.athlete.timeZone }).format(new Date(a.startedAt)) : null;
          return <li key={i}>{[a.sport ? SPORT_LABELS[a.sport] : null, formatDuration(a.seconds), a.distanceM ? formatDistance(a.distanceM) : null, t].filter(Boolean).join(' · ')}</li>;
        })}</Stack>
      ),
    }] : []),
    ...(fb.distanceM && fb.durationSeconds ? [{ label: 'Allure moyenne', value: formatPace(Math.round(fb.durationSeconds / (fb.distanceM / 1000))) }] : []),
    { label: 'Effort ressenti', value: fb.rpe !== null ? `${fb.rpe}/10` : 'Non renseigné' },
    ...(fb.readiness ? [{
      label: READINESS_QUESTION, value: readinessAlert(fb.readiness)
        ? <Stack gap={1}><span><Badge tone="warning" dot>{READINESS_LABELS[fb.readiness]}</Badge></span><Text size="sm" muted>Parles-en avec l’élève (message ou de vive voix) avant d’ajuster la suite.</Text></Stack>
        : READINESS_LABELS[fb.readiness],
    }] : []),
    { label: 'Ressenti général', value: fb.overallFeeling ? FEELING_LABELS[fb.overallFeeling as 1 | 2 | 3 | 4 | 5] : 'Non renseigné' },
    ...(fb.difficulties.length ? [{ label: 'Difficultés', value: fb.difficulties.map((d) => DIFFICULTY_LABELS[d]).join(', ') }] : []),
  ];

  return (
    <Stack gap={6}>
      <Cluster><LinkButton href={back.href} variant="ghost" size="sm" icon="chevronLeft">{back.label}</LinkButton></Cluster>
      {notice === 'reviewed' && done ? <Banner tone="success" title="Retour marqué comme traité" /> : null}
      {notice === 'enchaine' ? <Banner tone="success" title="Retour précédent traité · voici le suivant" /> : null}
      {notice === 'repondu' && done ? <Banner tone="success" title="Réponse envoyée, retour traité" /> : null}
      {notice === 'repondu-suivant' ? <Banner tone="success" title="Réponse envoyée, retour précédent traité · voici le suivant" /> : null}
      <Stack gap={2}>
        <Eyebrow tone="coach"><AthleteLink wid={wid} id={item.athleteId}>{item.athleteName}</AthleteLink>{observed ? ` · ${formatLongDate(observed.localDate)}` : ''}</Eyebrow>
        <Heading level={1} size={1}>Retour de {first}</Heading>
        <Cluster gap={2}>
          {done ? <Badge tone="success" dot>Traité</Badge> : <Badge tone="signal" dot>À traiter</Badge>}
          <Text size="sm" muted>Envoyé le {formatShortDate(fb.createdAt.slice(0, 10))}{fb.revision > 1 ? ` · corrigé par ${first} (version ${fb.revision} du retour)` : ''}</Text>
        </Cluster>
      </Stack>

      {test && observed ? (
        <Card as="section" pad={5} tinted aria-labelledby="test-title">
          <Stack gap={3}>
            <Cluster between gap={2}><Heading level={2} size={4} id="test-title">Résultat du test</Heading><Text size="sm" muted>Saisi par {first}</Text></Cluster>
            <Text size="md"><strong>{formatDuration2(test.seconds)}</strong> sur {formatDistance(test.meters)} · {formatPace(Math.round(test.seconds / (test.meters / 1000)))}
              {test.vma ? <> · VMA estimée <strong>{kmh(test.vma)}</strong> {refs?.vmaKmh ? `(actuelle : ${kmh(refs.vmaKmh)})` : '(aucune VMA renseignée)'}</> : null}</Text>
            {test.vma ? <Text size="sm" muted>Estimation : sur un test de cette durée, on tient environ {Math.round((test.meters / test.seconds) * 3.6 / test.vma * 100)} % de sa VMA. Les zones et les allures de {first} suivent la VMA que tu choisis.</Text> : null}
            <TestResultActions wid={wid} aid={item.athleteId} sport={observed.sport} name={observed.title} meters={test.meters} seconds={test.seconds}
              doneOn={observed.localDate} vmaKmh={test.vma} currentVma={refs?.vmaKmh ?? null} />
          </Stack>
        </Card>
      ) : null}

      <div className={s.compare}>
        <Card as="section" pad={5} aria-labelledby="planned">
          <Stack gap={4}>
            <Cluster between gap={2}><Heading level={2} size={4} id="planned">Prévu</Heading><Badge>Version {fb.observedRevision} vue par {first}</Badge></Cluster>
            {observed && view ? (
              <>
                <Stack gap={1}><Text strong size="md">{observed.title}</Text><Text size="sm" muted>{SPORT_LABELS[observed.sport]}{observed.distanceM ? ` · ${formatDistance(observed.distanceM)}` : ''}</Text></Stack>
                <SessionStats view={view} />
                <SessionStrip view={view} />
                <SessionRows view={view} />
                {observed.instructions ? <Text prose>{observed.instructions}</Text> : null}
              </>
            ) : <Text muted>Version observée indisponible.</Text>}
            {current && current.number !== fb.observedRevision ? (
              <Banner tone="warning">Depuis ce retour, la version {current.number} a été publiée. Ce retour porte sur la version {fb.observedRevision}.</Banner>
            ) : null}
          </Stack>
        </Card>
        <Card as="section" pad={5} aria-labelledby="declared">
          <Stack gap={5}>
            <Heading level={2} size={4} id="declared">Déclaré par {first}</Heading>
            <Facts items={facts} />
            {fb.strengthLog.length && observed ? <StrengthLog plan={strengthPlan(observed.intervals)} log={fb.strengthLog} /> : null}
            {fb.changes.length || fb.actualSport || fb.repeatsDone.length ? (
              <Stack gap={2}>
                <Text strong>Ce qui a changé</Text>
                {fb.changes.length ? <Text>{fb.changes.map((c) => CHANGE_LABELS[c]).join(' · ')}</Text> : null}
                {fb.actualSport ? <Text>Sport pratiqué : <strong>{SPORT_LABELS[fb.actualSport]}</strong></Text> : null}
                {fb.repeatsDone.length && observed ? (
                  <ul className={s.reps}>
                    {observed.intervals.filter((b) => b.type === 'repeat').map((r, i) => {
                      const doneN = fb.repeatsDone[i];
                      if (doneN === undefined || r.type !== 'repeat') return null;
                      return <li key={i}><Cluster gap={2}><Text size="sm">{describeBlock(r, observed.sport)}</Text><Badge tone={doneN < r.times ? 'warning' : 'success'}>{doneN} sur {r.times}</Badge></Cluster></li>;
                    })}
                  </ul>
                ) : null}
              </Stack>
            ) : null}
            <Stack gap={1}>
              <Text strong>Commentaire</Text>
              <Text prose muted={!fb.comment}>{fb.comment ?? 'Pas de commentaire.'}</Text>
            </Stack>
          </Stack>
        </Card>
      </div>

      <Card as="section" pad={5} aria-labelledby="treat">
        <Stack gap={5}>
          <Heading level={2} size={4} id="treat">Traiter</Heading>
          <QuickReply wid={wid} athleteId={item.athleteId} first={first} workoutId={w.id}
            review={done ? undefined : { sid: w.id, expectedRevision: fb.revision, after: afterReply }} />
          {done ? (
            <Text>Traité le {new Intl.DateTimeFormat('fr-BE', { dateStyle: 'long', timeStyle: 'short', timeZone: w.athlete.timeZone }).format(new Date(fb.reviewedAt!))}.</Text>
          ) : (
            <Stack gap={3}>
              <Text size="sm" muted>Marquer comme traité ferme ce cas dans la file. Aucun message n’est envoyé à {first}.</Text>
              <MarkReviewed wid={wid} aid={item.athleteId} sid={w.id} expectedRevision={fb.revision} after={after} />
              {item.snoozedUntil ? <Text size="sm" muted>Reporté : il reviendra dans la file à la date choisie.</Text>
                : <SnoozeReview wid={wid} rid={rid} choices={snoozeChoices(todayIn(tz), tz)} after={snoozeAfter} />}
            </Stack>
          )}
          <Cluster gap={2}>
            {next ? <LinkButton id="next-review" href={`${base}/review/${next.id}${keep(from ? `from=${from}` : '')}`} iconRight="arrowRight">Retour suivant · {next.athleteName.split(' ')[0]}</LinkButton> : null}
            <LinkButton href={`${base}/athletes/${item.athleteId}/workouts/${w.id}`} variant="ghost">Voir la séance</LinkButton>
          </Cluster>
          <ReviewKeys mode="detail" />
        </Stack>
      </Card>
    </Stack>
  );
}
