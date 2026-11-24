import Link from 'next/link';
import { addDays, APPOINTMENT_KIND_LABELS, dayOfMonth, formatEstimate, formatWeekRange, formatWeekday } from '@coachos/domain';
import type { AgendaDay } from '@/server/repo/portfolio';
import { Badge, Card, Cluster, Heading, Icon, IconLinkButton, LinkButton, Stack, Text } from '@/design';
import { cx } from '@/design/cx';
import s from './home.module.css';

/** Ma semaine (CE-H-05) : rendez-vous, créneaux de travail, échéances et séances publiées, jour par jour. */
export function Agenda({ base, week, monday, today, timeZone, href }: { base: string; week: AgendaDay[]; monday: string; today: string; timeZone: string; href: (week: string) => string }) {
  return (
    <Card as="section" pad={5} aria-labelledby="agenda-title" data-tour="planning-agenda">
      <Stack gap={4}>
        <Cluster between gap={2}>
          <Heading level={2} size={4} id="agenda-title">Semaine du {formatWeekRange(monday)}</Heading>
          <Cluster gap={1}>
            <IconLinkButton href={href(addDays(monday, -7))} icon="chevronLeft" label="Semaine précédente" size="sm" />
            <LinkButton href={href('')} size="sm">Cette semaine</LinkButton>
            <IconLinkButton href={href(addDays(monday, 7))} icon="chevronRight" label="Semaine suivante" size="sm" />
          </Cluster>
        </Cluster>
        <ol className={s.agenda}>
          {week.map((d) => {
            const free = !d.appointments.length && !d.tasksDue && !d.sessions && !d.slots.length;
            return (
              <li key={d.date} className={cx(s.day, d.date === today && s.dayToday, d.date < today && s.dayPast)} aria-current={d.date === today ? 'date' : undefined}>
                <div className={s.dayDate}><span>{formatWeekday(d.date).slice(0, 3)}</span><strong>{dayOfMonth(d.date)}</strong></div>
                <Stack gap={2} className={s.dayBody}>
                  {d.appointments.map((a) => (
                    <div key={a.id} className={s.appt}>
                      <Text size="sm"><strong className={s.time}>{a.localTime}</strong> {a.title} · <Link href={`${base}/athletes/${a.athleteId}#rdv`}>{a.athleteName}</Link></Text>
                      <Cluster gap={2}>
                        <Text size="sm" muted>{APPOINTMENT_KIND_LABELS[a.kind]} · {a.durationMin} min</Text>
                        {a.videoUrl ? <a className={s.join} href={a.videoUrl} target="_blank" rel="noopener noreferrer">Rejoindre<Icon name="arrowUpRight" size={14} /></a> : null}
                        {a.status === 'done' ? <Badge tone="success">Fait</Badge> : null}
                      </Cluster>
                    </div>
                  ))}
                  {d.slots.map((x) => (
                    <Text key={x.key} size="sm" className={s.slot}>
                      <Icon name="clock" size={14} /> {x.time ?? 'Dans la journée'} · {x.title}{x.athlete ? <> · <Link href={`${base}/athletes/${x.athlete.id}`}>{x.athlete.name}</Link></> : null}
                      {x.estimateMin ? <span className={s.muted}> · {formatEstimate(x.estimateMin)}</span> : null}
                    </Text>
                  ))}
                  {d.tasksDue || d.sessions ? (
                    <Text size="sm" muted>
                      {[d.tasksDue ? `${d.tasksDue} tâche${d.tasksDue > 1 ? 's' : ''} à échéance` : null, d.sessions ? `${d.sessions} séance${d.sessions > 1 ? 's' : ''} publiée${d.sessions > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  {free ? <Text size="sm" muted>Libre</Text> : null}
                </Stack>
              </li>
            );
          })}
        </ol>
        <Text size="sm" muted>Heures du fuseau de ton espace ({timeZone.replace(/_/g, ' ')}). Pour préparer les séances d’un élève : <Link href={`${base}/calendar`}>Calendrier</Link>.</Text>
      </Stack>
    </Card>
  );
}
