import { notFound } from 'next/navigation';
import {
  canGiveFeedback, formatDuration, formatLongDate, RESULT_STATE_LABELS, sessionView, SPORT_LABELS, strengthPlan, todayIn, type References,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteWorkout } from '@/server/repo/athlete';
import { athleteContext, isUuid } from '@/server/repo/context';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { exerciseMap } from '@/server/repo/exercises';
import {
  AnchorButton, Badge, Banner, Card, Cluster, Disclosure, Eyebrow, Heading, LinkButton, SessionRows, SessionStats, SessionStrip, Stack, Text,
} from '@/design';
import { ExerciseHowTo } from '@/views/athlete/exercise-howto';
import { StrengthLog } from '@/views/athlete/strength-log';

export const metadata = { title: 'Séance' };

/**
 * X42 · Lecture de la version publiée (refonte Chrono, D-129) : la séance d’un coup d’œil, ses cibles personnelles,
 * « Voir comment faire » sous chaque exercice, la montre, et le retour.
 */
export default async function AthleteWorkoutPage({ params, searchParams }: { params: Promise<{ wid: string; sid: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { wid, sid } = await params;
  const { notice } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx || !isUuid(sid)) notFound();
  const aid = ctx.athlete.id;
  const [found, refs] = await Promise.all([
    athleteWorkout(actor.userId, wid, aid, sid),
    readAthleteReferences(actor.userId, wid, aid).catch((): References => ({ vmaKmh: null, ftpW: null, cssSecPer100: null })),
  ]);
  if (!found) notFound();
  const { workout: w, feedback } = found;
  const exercises = await exerciseMap(actor.userId, wid, w.intervals);
  const today = todayIn(ctx.athlete.timeZone);
  const open = canGiveFeedback(w.localDate, today, w.canceled);
  const base = `/athlete/${wid}`;
  const view = sessionView(w.intervals, w.sport, refs, w.durationSeconds);
  const plan = strengthPlan(w.intervals);
  const followable = !w.canceled && w.intervals.length > 0 && (w.sport === 'strength' || plan.length > 0);
  const back = w.localDate === today ? { href: `${base}/today`, label: 'Aujourd’hui' } : { href: `${base}/schedule?week=${w.localDate}`, label: 'Programme' };

  return (
    <Stack gap={6}>
      <Cluster><LinkButton href={back.href} variant="ghost" size="sm" icon="chevronLeft">{back.label}</LinkButton></Cluster>
      {notice === 'sent' ? <Banner tone="success" title="Retour envoyé">Ton coach le verra dans sa boîte de réception.</Banner> : null}

      <Stack gap={1}>
        <Eyebrow tone="coach">{formatLongDate(w.localDate)} · {SPORT_LABELS[w.sport]}</Eyebrow>
        <Cluster gap={3} align="baseline"><Heading level={1} size={1}>{w.title}</Heading>{w.canceled ? <Badge tone="warning">Annulée</Badge> : null}</Cluster>
      </Stack>

      <div data-tour="workout-details"><SessionStats view={view} /></div>
      {w.intervals.length ? <Stack gap={6} data-tour="structure">
        <SessionStrip view={view} />
        <SessionRows view={view} extra={(r) => r.exerciseIds.length ? (
          <Stack gap={1}>{r.exerciseIds.map((id) => exercises[id] ? <ExerciseHowTo key={id} wid={wid} exercise={exercises[id]} /> : null)}</Stack>
        ) : null} />
      </Stack> : null}

      {w.instructions ? (
        <Card pad={4}><Stack gap={1}><Eyebrow>Consignes de ton coach</Eyebrow><Text prose>{w.instructions}</Text></Stack></Card>
      ) : !w.intervals.length ? <Text muted>Aucune consigne supplémentaire.</Text> : null}

      {w.canceled ? null : (
        <Stack gap={2}>
          <Cluster gap={2} grow>
            {followable ? <LinkButton href={`${base}/workouts/${sid}/suivre`} variant="coach" size="lg" icon="play">Suivre la séance</LinkButton> : null}
            <AnchorButton href={`/media/workspaces/${wid}/athletes/${aid}/workouts/${sid}/fit`} download size="lg" icon="watch">Pour ma montre</AnchorButton>
          </Cluster>
          <Disclosure summary="Comment la mettre sur ma montre ?">
            <Stack as="ol" gap={2}>
              <li><Text size="sm">1. Télécharge le fichier sur un ordinateur (il se termine par .fit).</Text></li>
              <li><Text size="sm">2. Branche ta montre Garmin avec son câble.</Text></li>
              <li><Text size="sm">3. Copie le fichier dans le dossier GARMIN › NewFiles de la montre, puis débranche-la.</Text></li>
              <li><Text size="sm">4. Sur la montre : Entraînement › Séances. Les cibles d’allure, de puissance ou de fréquence cardiaque sont reprises ; les zones sans VMA et le ressenti sont dans le nom ou la note de l’étape.</Text></li>
              <li><Text size="sm" muted>Sur Mac, la montre n’apparaît pas toujours dans le Finder : il faut alors un outil de transfert compatible.</Text></li>
            </Stack>
          </Disclosure>
        </Stack>
      )}

      <Card as="section" pad={5} aria-labelledby="mon-retour" data-tour="feedback-cta">
        <Stack gap={4}>
          <Cluster between><Heading level={2} size={4} id="mon-retour">Mon retour</Heading>{feedback ? <Badge tone="success" dot>{feedback.reviewedAt ? 'Lu par ton coach' : 'Envoyé'}</Badge> : null}</Cluster>
          {feedback ? (
            <Text size="md">
              <strong>{RESULT_STATE_LABELS[feedback.state]}</strong>
              {feedback.durationSeconds ? ` · ${formatDuration(feedback.durationSeconds)}` : ''}
              {feedback.rpe !== null ? ` · effort ${feedback.rpe}/10` : ''}
            </Text>
          ) : null}
          {feedback?.strengthLog.length ? <StrengthLog plan={plan} log={feedback.strengthLog} /> : null}
          {feedback && feedback.observedRevision !== w.revision ? (
            <Banner tone="warning">Ton coach a mis à jour cette séance après ton retour. Ton retour porte sur la version précédente.</Banner>
          ) : null}
          {open ? (
            <Cluster gap={2} grow>
              <LinkButton href={`${base}/workouts/${sid}/feedback`} variant={feedback ? 'secondary' : 'coach'} size="lg">{feedback ? 'Corriger mon retour' : 'Donner mon retour'}</LinkButton>
              <LinkButton href={`${base}/messages/coach?seance=${sid}`} size="lg" icon="chat">En parler à mon coach</LinkButton>
            </Cluster>
          ) : !feedback ? (
            <Text muted>{w.canceled ? 'Séance annulée : pas de retour attendu.' : 'Tu pourras donner ton retour à partir du jour de la séance.'}</Text>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
