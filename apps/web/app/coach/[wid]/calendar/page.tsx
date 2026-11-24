import Link from 'next/link';
import { goalsAwaitingProgram } from '@/server/commands/programs';
import { addDays, formatShortDate, formatWeekRange, isLocalDate, RESULT_STATE_LABELS, todayIn, weekDates, weekStart } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachWeek, listAssignedAthletes, openReviews } from '@/server/repo/coach';
import { weekProposals } from '@/server/commands/week-proposals';
import { listWeekTemplates } from '@/server/repo/library';
import { Avatar, Banner, Card, Cluster, EmptyState, Eyebrow, Heading, IconLinkButton, LinkButton, Stack, Text } from '@/design';
import { AthletePicker } from '@/views/coach/calendar/athlete-picker';
import { WeekAdapt } from '@/views/coach/calendar/week-adapt';
import { WeekGrid } from '@/views/coach/calendar/week-grid';
import { WeekTools } from '@/views/coach/calendar/week-tools';
import s from '@/views/coach/calendar/calendar.module.css';

export const metadata = { title: 'Calendrier' };

/**
 * X18, refonte Chrono (D-146) : semaine de l’élève choisi, dans son fuseau ; brouillon et publié distincts, publication
 * explicite, semaines types, adaptation de la semaine, retours de l’élève à traiter. Lectures en parallèle.
 */
export default async function Calendar({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ athlete?: string; week?: string; notice?: string }> }) {
  const { wid } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const base = `/coach/${wid}`;
  const roster = (await listAssignedAthletes(actor.userId, wid)).filter((a) => a.state !== 'archived');
  if (roster.length === 0) {
    return (
      <Stack gap={6}>
        <Heading level={1} size={1}>Calendrier</Heading>
        <EmptyState icon="calendar" title="Aucun élève pour l’instant" action={<LinkButton href={`${base}/athletes/new`} variant="primary" icon="plus" data-tour="add-athlete">Ajouter un élève</LinkButton>}>
          Commence par en ajouter un : tu pourras ensuite préparer et publier ses séances.
        </EmptyState>
      </Stack>
    );
  }
  // D-121 : par défaut un élève qui a rejoint l’espace, pas une fiche encore invitée.
  const athlete = roster.find((a) => a.id === sp.athlete) ?? roster.find((a) => a.state === 'active') ?? roster[0]!;
  const today = todayIn(athlete.timeZone);
  const monday = weekStart(sp.week && isLocalDate(sp.week) ? sp.week : today);
  const days = weekDates(monday);
  const [week, reviews, weekTemplates, adapt, awaiting] = await Promise.all([
    coachWeek(actor.userId, wid, athlete.id, days[0]!, days[6]!),
    openReviews(actor.userId, wid, athlete.id),
    listWeekTemplates(actor.userId, wid),
    athlete.state === 'active' ? weekProposals(actor.userId, wid, athlete.id, monday) : Promise.resolve(null),
    goalsAwaitingProgram(actor.userId, wid, athlete.id),
  ]);
  // Une séance annulée jamais publiée n’a rien à montrer ; annulée après publication, elle attend la republication (D-063).
  const workouts = week.filter((w) => !(w.canceled && w.publishedRevision === null));
  const weekHref = (m: string) => `${base}/calendar?athlete=${athlete.id}&week=${m}`;
  const thisWeek = today >= days[0]! && today <= days[6]!;
  const tourDay = thisWeek ? today : days[0]!;
  const newHref = (d: string) => `${base}/athletes/${athlete.id}/workouts/new?date=${d}`;
  const first = athlete.displayName.split(' ')[0] ?? athlete.displayName;
  const drafts = workouts.filter((w) => w.status !== 'published');

  return (
    <Stack gap={6}>
      <Stack gap={4}>
        <Cluster between gap={3} align="end">
          <Stack gap={1}>
            <Eyebrow tone="coach">{formatWeekRange(monday)} · heure de {first} ({athlete.timeZone.replace(/_/g, ' ')})</Eyebrow>
            <Heading level={1} size={1}>Semaine de {first}</Heading>
          </Stack>
          <LinkButton href={newHref(tourDay)} variant="primary" icon="plus">Nouvelle séance</LinkButton>
        </Cluster>
        <Cluster gap={2}>
          <AthletePicker wid={wid} week={monday} selected={athlete.id} athletes={roster.map((a) => ({ id: a.id, name: a.displayName + (a.state === 'invited' ? ' (invité·e)' : '') }))} />
          <IconLinkButton href={weekHref(addDays(monday, -7))} icon="chevronLeft" label="Semaine précédente" />
          <LinkButton href={weekHref(weekStart(today))} variant={thisWeek ? 'ghost' : 'secondary'}>Cette semaine</LinkButton>
          <IconLinkButton href={weekHref(addDays(monday, 7))} icon="chevronRight" label="Semaine suivante" />
        </Cluster>
      </Stack>

      {awaiting.map((g) => (
        <Banner key={g.id} tone="coach" title="Prochaine étape"
          action={<LinkButton href={`${base}/athletes/${athlete.id}/programme?objectif=${g.id}`} size="sm" variant="primary" icon="calendar">Générer le programme</LinkButton>}>
          L’objectif « {g.title} » est validé. Génère le programme qui permet de l’atteindre : tu relis les risques, rien n’est publié.
        </Banner>
      ))}
      {sp.notice === 'program' ? <Banner tone="success" title="Programme créé en brouillons">Semaine par semaine. Relis, ajuste, puis « Publier la semaine » quand tout te convient.</Banner> : null}
      {sp.notice === 'regenerated' ? <Banner tone="success" title="Semaines régénérées en brouillons">Les séances déjà publiées et modifiées attendent ta republication (« Publier la semaine »).</Banner> : null}

      <Stack as="section" gap={4} aria-labelledby="week-title">
        <h2 id="week-title" className="ds-visually-hidden">Séances de la semaine du {formatShortDate(monday)}</h2>
        <WeekGrid wid={wid} aid={athlete.id} first={first} days={days} workouts={workouts} today={today} tourDay={tourDay} />
        <Text size="sm" muted>Brouillon : invisible pour {first} · Publiée : visible · Modifiée : {first} lit encore la version publiée, à republier.</Text>
        <WeekTools wid={wid} athleteId={athlete.id} first={first} monday={monday} hasSessions={workouts.some((w) => !w.canceled)}
          drafts={drafts.map((w) => ({ id: w.id, revision: w.workingRevision, title: w.title, localDate: w.localDate, changed: w.status === 'changed' }))}
          templates={weekTemplates.map((t) => ({ id: t.id, title: t.title, weeks: t.weeks, days: t.days.map((d) => ({ offset: d.offset, title: d.workout.title })) }))} />
        {adapt && adapt.sessions.length ? (
          <WeekAdapt wid={wid} aid={athlete.id} monday={monday} first={first} proposals={adapt.proposals}
            seen={adapt.sessions.map((x) => ({ id: x.id, revision: x.revision }))} />
        ) : null}
      </Stack>

      <Card as="section" pad={5} aria-labelledby="reviews-title">
        <Stack gap={4}>
          <Cluster between gap={2}>
            <Heading level={2} size={4} id="reviews-title">Retours de {first} à traiter</Heading>
            <Link href={`${base}/review`}>Tous les retours</Link>
          </Cluster>
          {reviews.length ? (
            <ul className={s.rows}>
              {reviews.map((r) => (
                <li key={r.id}>
                  <Avatar name={r.athleteName} size={36} />
                  <span className={s.rowText}>
                    <span className={s.rowTitle}>{r.title ?? 'Séance indisponible'}</span>
                    <span className={s.rowMeta}>{[r.localDate ? formatShortDate(r.localDate) : null, r.resultState ? RESULT_STATE_LABELS[r.resultState] : null, r.rpe !== null ? `effort ${r.rpe}/10` : null, r.hasComment ? 'commentaire' : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  <LinkButton href={`${base}/review/${r.id}?from=calendar`} size="sm">Ouvrir le retour</LinkButton>
                </li>
              ))}
            </ul>
          ) : <Text muted>Aucun retour à traiter pour {first}.</Text>}
        </Stack>
      </Card>
    </Stack>
  );
}
