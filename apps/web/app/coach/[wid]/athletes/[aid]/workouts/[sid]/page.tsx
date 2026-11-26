import { notFound } from 'next/navigation';
import { formatDistance, formatDuration, formatLongDate, RESULT_STATE_LABELS, sessionView, SPORT_LABELS, weekStart, WORKOUT_STATUS_LABELS, type References } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachWorkout, type RevisionView } from '@/server/repo/coach';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import { exerciseMap } from '@/server/repo/exercises';
import {
  AnchorButton, Badge, Banner, Card, Cluster, Eyebrow, Heading, LinkButton, SessionRows, SessionStats, SessionStrip, Stack, Text, type Tone,
} from '@/design';
import { ExerciseHowTo } from '@/views/athlete/exercise-howto';
import { PublishButton, SaveToLibrary } from '@/views/coach/workout/workout-actions';
import s from '@/views/coach/review/review.module.css';
import { AthleteLink } from '@/views/coach/athlete-link';

export const metadata = { title: 'Séance' };

const NOTICES: Record<string, { title: string; text: string }> = {
  saved: { title: 'Brouillon enregistré', text: 'Il reste invisible pour l’élève tant qu’il n’est pas publié.' },
  published: { title: 'Séance publiée', text: 'L’élève la voit maintenant dans Aujourd’hui et Programme.' },
};
const STATUS_TONE: Record<string, Tone> = { draft: 'neutral', published: 'success', changed: 'warning' };

type Exercises = Awaited<ReturnType<typeof exerciseMap>>;

/** Une version de la séance, avec les pièces que lit l’élève : chiffres, bande des zones, blocs, comment faire. */
function Prescription({ r, refs, wid, exercises }: { r: RevisionView; refs: References; wid: string; exercises: Exercises }) {
  const view = sessionView(r.intervals, r.sport, refs, r.durationSeconds);
  return (
    <Stack gap={4}>
      <Text size="sm" muted>{formatLongDate(r.localDate)} · {SPORT_LABELS[r.sport]}{!r.intervals.length && r.durationSeconds ? ` · ${formatDuration(r.durationSeconds)}` : ''}{r.distanceM && !r.intervals.length ? ` · ${formatDistance(r.distanceM)}` : ''}</Text>
      {r.intervals.length ? (
        <Stack gap={4} data-tour="structure">
          <SessionStats view={view} />
          <SessionStrip view={view} />
          <SessionRows view={view} extra={(row) => row.exerciseIds.length ? (
            <Stack gap={1}>{row.exerciseIds.map((id) => exercises[id] ? <ExerciseHowTo key={id} wid={wid} exercise={exercises[id]} /> : null)}</Stack>
          ) : null} />
        </Stack>
      ) : null}
      {r.instructions || !r.intervals.length ? (
        <Stack gap={1}>
          <Text strong>Consignes</Text>
          <Text prose muted={!r.instructions}>{r.instructions || 'Aucune consigne supplémentaire.'}</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}

/** X21 + confirmation X22, refonte Chrono (D-147) : version de travail, version publiée, publication explicite. */
export default async function CoachWorkout({ params, searchParams }: { params: Promise<{ wid: string; aid: string; sid: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { wid, aid, sid } = await params;
  const { notice } = await searchParams;
  const actor = await requireActor();
  const [refs, w] = await Promise.all([readAthleteReferences(actor.userId, wid, aid), coachWorkout(actor.userId, wid, aid, sid)]);
  if (!w) notFound();
  const exercises = await exerciseMap(actor.userId, wid, w.working.intervals, w.published?.intervals ?? []);
  const first = w.athlete.displayName.split(' ')[0] ?? w.athlete.displayName;
  const base = `/coach/${wid}`;
  const back = `${base}/calendar?athlete=${aid}&week=${weekStart(w.working.localDate)}`;
  const n = notice ? NOTICES[notice] : null;

  return (
    <Stack gap={6}>
      <Cluster><LinkButton href={back} variant="ghost" size="sm" icon="chevronLeft">Semaine de {first}</LinkButton></Cluster>
      {n ? <Banner tone="success" title={n.title}>{n.text}</Banner> : null}
      <Stack gap={3}>
        <Stack gap={1}>
          <Eyebrow tone="coach"><AthleteLink wid={wid} id={aid}>{w.athlete.displayName}</AthleteLink> · {formatLongDate(w.working.localDate)}</Eyebrow>
          <Heading level={1} size={1}>{w.working.title}</Heading>
        </Stack>
        <Cluster gap={2}>
          {w.working.canceled ? <Badge tone="danger">Annulée</Badge> : null}
          <Badge tone={STATUS_TONE[w.status] ?? 'neutral'} dot>{WORKOUT_STATUS_LABELS[w.status]}</Badge>
          <Text size="sm" muted>{w.status === 'draft' ? `Invisible pour ${first}.` : w.status === 'published' ? `${first} lit cette version.` : `${first} lit encore la version ${w.published?.number}.`}</Text>
        </Cluster>
        <Cluster gap={2}>
          <LinkButton href={`${base}/athletes/${aid}/workouts/${sid}/edit`} variant="primary" icon="edit">Modifier</LinkButton>
          <LinkButton href={`${base}/messages/${aid}?seance=${sid}`} icon="chat">En parler à {first}</LinkButton>
          <SaveToLibrary wid={wid} aid={aid} sid={sid} />
          {w.working.canceled ? null : <AnchorButton href={`/media/workspaces/${wid}/athletes/${aid}/workouts/${sid}/fit`} download icon="watch">Fichier FIT</AnchorButton>}
        </Cluster>
      </Stack>

      {w.status !== 'published' ? (
        <Card as="section" pad={5} tinted aria-labelledby="publish-title">
          <Stack gap={3}>
            <Heading level={2} size={4} id="publish-title">{w.status === 'draft' ? 'Publier' : 'Publier la modification'}</Heading>
            <Text>
              {first} verra « {w.working.title} » le <strong>{formatLongDate(w.working.localDate).toLowerCase()}</strong> (fuseau {w.working.timeZone.replace(/_/g, ' ')}).
              {w.status === 'changed' ? ' La version actuellement lue sera remplacée.' : ''}
            </Text>
            <PublishButton wid={wid} aid={aid} sid={sid} revision={w.working.number} label={w.status === 'draft' ? `Publier pour ${first}` : `Publier la version ${w.working.number}`} />
          </Stack>
        </Card>
      ) : null}

      <div className={w.status === 'changed' ? s.compare : undefined}>
        <Card as="section" pad={5} aria-labelledby="working-title">
          <Stack gap={4}>
            <Heading level={2} size={4} id="working-title">{w.status === 'changed' ? `Brouillon · version ${w.working.number}` : `Version ${w.working.number}`}</Heading>
            <Prescription r={w.working} refs={refs} wid={wid} exercises={exercises} />
          </Stack>
        </Card>
        {w.status === 'changed' && w.published ? (
          <Card as="section" pad={5} aria-labelledby="published-title">
            <Stack gap={4}>
              <Cluster between gap={2}><Heading level={2} size={4} id="published-title">Publiée · version {w.published.number}</Heading><Badge>Lue par {first}</Badge></Cluster>
              <Prescription r={w.published} refs={refs} wid={wid} exercises={exercises} />
            </Stack>
          </Card>
        ) : null}
      </div>

      <Card as="section" pad={5} aria-labelledby="fb-title">
        <Stack gap={3}>
          <Heading level={2} size={4} id="fb-title">Retour de {first}</Heading>
          {w.feedback ? (
            <Cluster between gap={3}>
              <Stack gap={1}>
                <Text strong>{RESULT_STATE_LABELS[w.feedback.state]}{w.feedback.rpe !== null ? ` · effort ${w.feedback.rpe}/10` : ''}</Text>
                <Text size="sm" muted>{w.feedback.reviewedAt ? 'Traité' : 'À traiter'} · sur la version {w.feedback.observedRevision}</Text>
              </Stack>
              {w.reviewItemId ? <LinkButton href={`${base}/review/${w.reviewItemId}?from=calendar`} size="sm">Ouvrir le retour</LinkButton> : null}
            </Cluster>
          ) : <Text muted>Pas encore de retour. L’absence de retour ne signifie pas que la séance a été manquée.</Text>}
        </Stack>
      </Card>
    </Stack>
  );
}
