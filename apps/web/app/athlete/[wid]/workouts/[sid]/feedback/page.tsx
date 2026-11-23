import { notFound } from 'next/navigation';
import { canGiveFeedback, formatLongDate, SPORT_LABELS, todayIn } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteWorkout } from '@/server/repo/athlete';
import { athleteContext, isUuid } from '@/server/repo/context';
import { Cluster, EmptyState, Eyebrow, Heading, LinkButton, Stack, Text } from '@/design';
import { FeedbackForm } from '@/views/athlete/feedback-form';

export const metadata = { title: 'Mon retour' };

/** X43 · Décrire le réalisé (refonte Chrono, D-132). */
export default async function FeedbackPage({ params }: { params: Promise<{ wid: string; sid: string }> }) {
  const { wid, sid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx || !isUuid(sid)) notFound();
  const found = await athleteWorkout(actor.userId, wid, ctx.athlete.id, sid);
  if (!found) notFound();
  const { workout: w, feedback } = found;
  const back = `/athlete/${wid}/workouts/${sid}`;
  const open = canGiveFeedback(w.localDate, todayIn(ctx.athlete.timeZone), w.canceled);

  return (
    <Stack gap={6}>
      <Cluster><LinkButton href={back} variant="ghost" size="sm" icon="chevronLeft">Séance</LinkButton></Cluster>
      <Stack gap={1}>
        <Eyebrow tone="coach">{formatLongDate(w.localDate)} · {SPORT_LABELS[w.sport]}</Eyebrow>
        <Heading level={1} size={1}>{feedback ? 'Corriger mon retour' : 'Mon retour'}</Heading>
        <Text size="md" muted>{w.title}</Text>
      </Stack>
      {open ? (
        <FeedbackForm wid={wid} aid={ctx.athlete.id} sid={sid} publishedRevision={w.revision} workspaceName={ctx.workspace.name}
          plannedMinutes={w.durationSeconds ? Math.round(w.durationSeconds / 60) : null}
          intervals={w.intervals} title={w.title} sport={w.sport} plannedDate={w.localDate} timeZone={ctx.athlete.timeZone}
          existing={feedback ? { revision: feedback.revision, state: feedback.state, durationSeconds: feedback.durationSeconds, distanceM: feedback.distanceM, rpe: feedback.rpe, comment: feedback.comment, overallFeeling: feedback.overallFeeling, readiness: feedback.readiness, difficulties: feedback.difficulties, changes: feedback.changes, actualSport: feedback.actualSport, repeatsDone: feedback.repeatsDone, measureFile: feedback.measureFile, activities: feedback.activities, testSeconds: feedback.testSeconds, strengthLog: feedback.strengthLog } : null} />
      ) : (
        <EmptyState icon="clock" title={w.canceled ? 'Séance annulée' : 'Pas encore'} action={<LinkButton href={back}>Voir la séance</LinkButton>}>
          {w.canceled ? 'Pas de retour attendu pour une séance annulée.' : 'Le retour s’ouvre le jour de la séance.'}
        </EmptyState>
      )}
    </Stack>
  );
}
