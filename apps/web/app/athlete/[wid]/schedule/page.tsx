import { notFound } from 'next/navigation';
import {
  addDays, addMonths, dayOfMonth, formatDuration, formatMonth, formatWeekRange, isLocalDate, monthStart, monthWeeks,
  sessionView, todayIn, weekDates, weekStart, SPORT_LABELS, type LocalDate,
} from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { athleteSchedule, type AthleteWorkout } from '@/server/repo/athlete';
import { athleteContext } from '@/server/repo/context';
import {
  Cluster, EmptyState, Eyebrow, Heading, IconLinkButton, LinkButton, MonthGrid, SegmentedLinks, Stack, Stats, Text, WeekDays,
  type CalendarDay, type CalendarItem,
} from '@/design';

export const metadata = { title: 'Programme' };

const SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function item(base: string, w: AthleteWorkout): CalendarItem {
  const view = sessionView(w.intervals, w.sport, undefined, w.durationSeconds);
  const duration = formatDuration(w.durationSeconds);
  return {
    id: w.id,
    href: `${base}/workouts/${w.id}`,
    title: w.title,
    zone: view.keyZone,
    tag: w.sport === 'strength' ? 'Force' : undefined,
    meta: `${SPORT_LABELS[w.sport]}${duration ? ` · ${duration}` : ''}`,
    done: Boolean(w.feedbackState),
    canceled: w.canceled,
  };
}

/** Totaux d’une liste de séances : les séances annulées ne comptent pas. */
function totals(list: AthleteWorkout[]) {
  const kept = list.filter((w) => !w.canceled);
  return { count: kept.length, seconds: kept.reduce((n, w) => n + (w.durationSeconds ?? 0), 0), sent: kept.filter((w) => w.feedbackState).length };
}

/**
 * X41 · Programme (refonte Chrono, D-131) : la semaine jour par jour, repos compris, ou le mois en grille.
 * Seules les séances publiées apparaissent ; les brouillons du coach jamais.
 */
export default async function Schedule({ params, searchParams }: { params: Promise<{ wid: string }>; searchParams: Promise<{ week?: string; month?: string; view?: string }> }) {
  const { wid } = await params;
  const { week, month, view } = await searchParams;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const today = todayIn(ctx.athlete.timeZone);
  const base = `/athlete/${wid}`;
  const isMonth = view === 'month';
  const toggle = (
    <SegmentedLinks label="Affichage du programme" items={[
      { href: `${base}/schedule`, label: 'Semaine', current: !isMonth },
      { href: `${base}/schedule?view=month`, label: 'Mois', current: isMonth },
    ]} />
  );

  if (isMonth) {
    const first = monthStart(month && isLocalDate(`${month}-01`) ? `${month}-01` : today);
    const mondays = monthWeeks(first);
    const items = await athleteSchedule(actor.userId, wid, ctx.athlete.id, mondays[0]!, addDays(mondays.at(-1)!, 6));
    const byDay = new Map<string, AthleteWorkout[]>();
    for (const w of items) byDay.set(w.localDate, [...(byDay.get(w.localDate) ?? []), w]);
    const ym = (d: string) => d.slice(0, 7);
    const all = totals(items.filter((w) => ym(w.localDate) === ym(first)));
    const weeks = mondays.map((monday) => {
      const days: CalendarDay[] = weekDates(monday).map((d, k) => {
        const ws = byDay.get(d) ?? [];
        return {
          date: d, name: LONG[k]!, num: String(dayOfMonth(d)), today: d === today, out: ym(d) !== ym(first),
          href: ws.length === 1 ? `${base}/workouts/${ws[0]!.id}` : `${base}/schedule?week=${monday}`,
          items: ws.map((w) => item(base, w)),
        };
      });
      const t = totals(weekDates(monday).flatMap((d) => byDay.get(d) ?? []));
      return { days, total: { main: (t.seconds && formatDuration(t.seconds)) || '', sub: t.count ? `${t.sent}/${t.count} retour${t.count > 1 ? 's' : ''}` : 'repos' } };
    });

    return (
      <Stack gap={5}>
        <Stack gap={1}>
          <Eyebrow tone="coach">{formatMonth(first)}</Eyebrow>
          <Heading level={1} size={1}>Programme</Heading>
        </Stack>
        <Cluster between gap={3}>
          {toggle}
          <Cluster gap={2} nowrap>
            <IconLinkButton href={`${base}/schedule?view=month&month=${ym(addMonths(first, -1))}`} icon="chevronLeft" label="Mois précédent" />
            <LinkButton href={`${base}/schedule?view=month`}>Ce mois-ci</LinkButton>
            <IconLinkButton href={`${base}/schedule?view=month&month=${ym(addMonths(first, 1))}`} icon="chevronRight" label="Mois suivant" />
          </Cluster>
        </Cluster>
        <Stats size={28} items={[
          { label: 'Séances', value: all.count || '—' },
          { label: 'Volume', value: (all.seconds && formatDuration(all.seconds)) || '—' },
          { label: 'Retours', value: all.count ? `${all.sent}/${all.count}` : '—' },
        ]} />
        <MonthGrid weeks={weeks} dayNames={SHORT} label={`Séances publiées en ${formatMonth(first)}`} />
        <Text size="sm" muted>Une pastille par séance, de la couleur de sa zone ; cerclée quand ton retour est envoyé. Touche un jour pour ouvrir la séance ou sa semaine.</Text>
      </Stack>
    );
  }

  const monday = weekStart(week && isLocalDate(week) ? week : today);
  const dates = weekDates(monday);
  const items = await athleteSchedule(actor.userId, wid, ctx.athlete.id, dates[0]!, dates[6]!);
  const t = totals(items);
  const days: CalendarDay[] = dates.map((d: LocalDate, k) => ({
    date: d, name: SHORT[k]!, num: String(dayOfMonth(d)), today: d === today,
    items: items.filter((w) => w.localDate === d).map((w) => item(base, w)),
  }));
  const isThisWeek = monday === weekStart(today);

  return (
    <Stack gap={5}>
      <Stack gap={1}>
        <Eyebrow tone="coach">{isThisWeek ? 'Cette semaine · ' : ''}{formatWeekRange(monday)}</Eyebrow>
        <Heading level={1} size={1}>Programme</Heading>
      </Stack>
      <Cluster between gap={3}>
        {toggle}
        <Cluster gap={2} nowrap>
          <IconLinkButton href={`${base}/schedule?week=${addDays(monday, -7)}`} icon="chevronLeft" label="Semaine précédente" />
          <LinkButton href={`${base}/schedule`} aria-current={isThisWeek ? 'page' : undefined}>Cette semaine</LinkButton>
          <IconLinkButton href={`${base}/schedule?week=${addDays(monday, 7)}`} icon="chevronRight" label="Semaine suivante" />
        </Cluster>
      </Cluster>
      {items.length ? (
        <>
          <Stats size={28} items={[
            { label: 'Séances', value: t.count || '—' },
            { label: 'Volume', value: (t.seconds && formatDuration(t.seconds)) || '—' },
            { label: 'Retours', value: t.count ? `${t.sent}/${t.count}` : '—' },
          ]} />
          <WeekDays days={days} label={`Semaine du ${formatWeekRange(monday)}`} />
        </>
      ) : (
        <EmptyState icon="calendar" title="Aucune séance publiée cette semaine.">
          Ton coach n’a encore rien publié pour ces dates. Les séances apparaîtront ici dès qu’il les publie.
        </EmptyState>
      )}
    </Stack>
  );
}
