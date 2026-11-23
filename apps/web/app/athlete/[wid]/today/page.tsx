import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addDays, bilanCompletion, canGiveFeedback, deriveBilan, effortGap, formatLongDate, formatShortDate, RESULT_STATE_LABELS, sessionIntent, sessionView, SPORT_LABELS, todayIn,
  type References,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteSchedule, nextWorkout, type AthleteWorkout } from '@/server/repo/athlete';
import { athleteContext } from '@/server/repo/context';
import { readAthleteProfile, readBilanDraft } from '@/server/commands/athlete-profile';
import { readAthleteReferences } from '@/server/commands/athlete-references';
import {
  Badge, Banner, Card, Cluster, EmptyState, Eyebrow, Heading, LinkButton, LinkList, LinkListItem, SessionRows, SessionStats, SessionStrip, Stack, Text, VisuallyHidden, ZoneChip, type ZoneLevel,
} from '@/design';
import { FeedbackSent, QuickFeedback } from '@/views/athlete/quick-feedback';

export const metadata = { title: 'Aujourd’hui' };

const dayLabel = (d: string) => formatShortDate(d).replace(/\.$/, '');
const strength = (w: AthleteWorkout) => w.sport === 'strength' || JSON.stringify(w.intervals).includes('"exercise":{');

/**
 * X40 · Aujourd’hui (refonte Chrono, D-129) : la séance du jour dans ses allures d’un coup d’œil, la suivre,
 * le retour en 15 secondes, puis la suite de la semaine. Toutes les lectures partent en même temps.
 */
export default async function Today({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { wid } = await params;
  const { notice } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const aid = ctx.athlete.id;
  const today = todayIn(ctx.athlete.timeZone);
  const yesterday = addDays(today, -1);
  const [todays, pastDay, week, next, profile, refs] = await Promise.all([
    athleteSchedule(actor.userId, wid, aid, today, today),
    athleteSchedule(actor.userId, wid, aid, yesterday, yesterday),
    athleteSchedule(actor.userId, wid, aid, addDays(today, 1), addDays(today, 6)),
    nextWorkout(actor.userId, wid, aid, today),
    readAthleteProfile(actor.userId, wid, aid),
    readAthleteReferences(actor.userId, wid, aid).catch((): References => ({ vmaKmh: null, ftpW: null, cssSecPer100: null })),
  ]);
  const draft = profile ? null : await readBilanDraft(actor.userId, wid, aid);
  const progress = draft ? bilanCompletion(deriveBilan(draft.answers)) : null;
  const pending = pastDay.filter((w) => !w.canceled && !w.feedbackState);
  const upcoming = week.filter((w) => !w.canceled).slice(0, 4);
  const base = `/athlete/${wid}`;

  const feedback = (w: AthleteWorkout, when: string) => {
    if (w.canceled || !canGiveFeedback(w.localDate, today, w.canceled)) return null;
    const intent = sessionIntent(w.intervals);
    const detailHref = `${base}/workouts/${w.id}/feedback`;
    if (!w.feedbackState) return <QuickFeedback wid={wid} aid={aid} sid={w.id} revision={w.revision} intent={intent} when={when} detailHref={detailHref} />;
    return <FeedbackSent stateLabel={RESULT_STATE_LABELS[w.feedbackState]} gap={effortGap(intent, w.feedbackRpe)} intent={intent} detailHref={detailHref} />;
  };

  return (
    <Stack gap={6}>
      <VisuallyHidden><h1>Aujourd’hui</h1></VisuallyHidden>
      {notice === 'joined' ? <Banner tone="success" title={`Bienvenue dans ${ctx.workspace.name}`}>Tes séances publiées apparaissent ici et dans Programme.</Banner> : null}
      {!profile ? (
        <Banner tone="coach" title="Ton bilan" action={<LinkButton href={`${base}/setup`} size="sm" variant="coach">{progress ? 'Continuer' : 'Commencer'}</LinkButton>}>
          {progress ? `${progress.answered} réponse${progress.answered > 1 ? 's' : ''} sur ${progress.total}.` : '2 minutes'} pour que ton coach prépare un programme qui te ressemble.
        </Banner>
      ) : null}

      {todays.length ? todays.map((w, k) => {
        const view = sessionView(w.intervals, w.sport, refs, w.durationSeconds);
        const fb = feedback(w, 'd’aujourd’hui');
        return (
          <Stack as="article" key={w.id} gap={4} aria-labelledby={`t-${w.id}`} data-tour={k === 0 ? 'today-card' : undefined}>
            <Stack gap={1}>
              <Eyebrow tone="coach">{formatLongDate(today)} · {SPORT_LABELS[w.sport]}</Eyebrow>
              <Cluster gap={3} align="baseline"><Heading level={2} size={1} id={`t-${w.id}`}>{w.title}</Heading>{w.canceled ? <Badge tone="warning">Annulée</Badge> : null}</Cluster>
            </Stack>
            <SessionStats view={view} />
            <SessionStrip view={view} />
            <SessionRows view={view} />
            {w.instructions ? <Card pad={4}><Stack gap={1}><Eyebrow>Consignes de ton coach</Eyebrow><Text prose>{w.instructions}</Text></Stack></Card> : null}
            <Cluster gap={2} grow>
              {strength(w) && w.intervals.length && !w.canceled
                ? <LinkButton href={`${base}/workouts/${w.id}/suivre`} variant="coach" size="lg" icon="play">Suivre la séance</LinkButton>
                : null}
              <LinkButton href={`${base}/workouts/${w.id}`} variant={strength(w) ? 'secondary' : 'coach'} size="lg" data-tour={k === 0 ? 'today-open' : undefined}>Voir la séance</LinkButton>
            </Cluster>
            {fb ? <Card pad={4}>{fb}</Card> : null}
          </Stack>
        );
      }) : (
        <Stack gap={4}>
          <Stack gap={1}><Eyebrow tone="coach">{formatLongDate(today)}</Eyebrow><Heading level={2} size={1}>Repos</Heading></Stack>
          <div data-tour="today-empty">
            <EmptyState icon="calendar" title="Pas de séance aujourd’hui" action={next ? <LinkButton href={`${base}/workouts/${next.id}`} variant="coach">Voir la prochaine</LinkButton> : null}>
              {next ? `Prochaine séance : ${next.title}, ${dayLabel(next.localDate)}.` : 'Ton coach n’a pas encore publié la suite. Tu seras prévenu·e.'}
            </EmptyState>
          </div>
        </Stack>
      )}

      {pending.map((w) => (
        <Card as="section" key={w.id} pad={4} aria-labelledby={`p-${w.id}`}>
          <Stack gap={3}>
            <Stack gap={1}><Eyebrow>Hier · {SPORT_LABELS[w.sport]}</Eyebrow><Heading level={2} size={4} id={`p-${w.id}`}>{w.title}</Heading></Stack>
            {feedback(w, 'd’hier')}
          </Stack>
        </Card>
      ))}

      {upcoming.length ? (
        <Stack as="section" gap={3} aria-labelledby="suite">
          <Cluster between align="baseline"><Heading level={2} size={4} id="suite">La suite de ta semaine</Heading><Link href={`${base}/schedule`}>Tout le programme</Link></Cluster>
          <LinkList label="Séances à venir">
            {upcoming.map((w) => {
              const v = sessionView(w.intervals, w.sport, refs, w.durationSeconds);
              return <LinkListItem key={w.id} href={`${base}/workouts/${w.id}`} leading={<ZoneChip zone={Math.min(7, v.keyZone) as ZoneLevel} />} title={w.title} meta={`${dayLabel(w.localDate)}${v.minutes ? ` · ${v.minutes} min` : ''}`} />;
            })}
          </LinkList>
        </Stack>
      ) : null}
    </Stack>
  );
}
