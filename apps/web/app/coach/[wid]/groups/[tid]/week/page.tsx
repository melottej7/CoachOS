import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, formatShortDate, formatWeekday, isLocalDate, RESULT_STATE_LABELS, todayIn, weekStart, type ResultState } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext, isUuid } from '@/server/repo/context';
import { teamWeek, type TeamWeekItem } from '@/server/repo/group-sessions';
import { aiEnabled } from '@/server/ai/settings';
import { Cluster, EmptyState, Eyebrow, Heading, Icon, IconLinkButton, LinkButton, Stack, Text } from '@/design';
import { cx } from '@/design/cx';
import s from '@/views/coach/calendar/calendar.module.css';

export const metadata = { title: 'Semaine du groupe' };

const day = (d: string) => formatShortDate(d).replace(/\.$/, '');

function Cell({ it, href }: { it: TeamWeekItem; href: string }) {
  const tag = it.canceled ? 'Annulée'
    : it.result ? RESULT_STATE_LABELS[it.result as ResultState]
    : it.status === 'draft' ? 'Brouillon' : it.status === 'changed' ? 'Modifiée, non republiée' : 'Publiée';
  const tone = it.canceled || it.status !== 'published' ? s.cellPending : it.result === 'completed' ? s.cellDone : it.result === 'missed' ? s.cellMissed : undefined;
  return (
    <Link href={href} className={cx(s.cell, tone)}>
      <span className={s.cellTitle}>{it.groupSessionId ? <Icon name="users" size={14} /> : null}{it.title}</span>
      <span className={s.cellTag}>{tag}</span>
    </Link>
  );
}

/** CE-G2-03, refonte Chrono (D-148) : la semaine d’un groupe avec l’état de chaque élève. */
export default async function TeamWeek({ params, searchParams }: { params: Promise<{ wid: string; tid: string }>; searchParams: Promise<{ semaine?: string }> }) {
  const { wid, tid } = await params;
  const { semaine } = await searchParams;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx || !isUuid(tid)) notFound();
  const today = todayIn(ctx.workspace.timeZone);
  const monday = weekStart(semaine && isLocalDate(semaine) ? semaine : today);
  const days = Array.from({ length: 7 }, (_, k) => addDays(monday, k));
  const w = await teamWeek(actor.userId, wid, tid, monday, days[6]!);
  if (!w) notFound();
  const base = `/coach/${wid}`;
  const aiOn = await aiEnabled(actor.userId, wid);
  const here = `${base}/groups/${tid}/week`;
  const published = w.items.filter((i) => i.status === 'published' && !i.canceled).length;
  const drafts = w.items.filter((i) => i.status !== 'published').length;
  const without = w.members.filter((m) => !w.items.some((i) => i.athleteId === m.id && !i.canceled));
  return (
    <Stack gap={6}>
      <Cluster><LinkButton href={`${base}/group-sessions`} variant="ghost" size="sm" icon="chevronLeft">Séances de groupe</LinkButton></Cluster>
      <Cluster between gap={3} align="end">
        <Stack gap={1}>
          <Eyebrow tone="coach">Groupe · {w.name}</Eyebrow>
          <Heading level={1} size={1}>Semaine du {day(monday)}</Heading>
          <Text muted>{published} séance{published > 1 ? 's' : ''} publiée{published > 1 ? 's' : ''} · {drafts} brouillon{drafts > 1 ? 's' : ''} ou modification{drafts > 1 ? 's' : ''} à publier{without.length ? ` · sans séance : ${without.map((m) => m.name.split(' ')[0]).join(', ')}` : ''}</Text>
        </Stack>
        <Cluster gap={2}>
          <LinkButton href={`${base}/groups/${tid}/sessions/new?date=${days.find((d) => d >= today) ?? monday}`} variant="primary" icon="plus">Séance pour le groupe</LinkButton>
          {aiOn ? <LinkButton href={`${base}/groups/${tid}/programme-ia`} icon="bolt">Programme avec l’IA</LinkButton> : null}
        </Cluster>
      </Cluster>
      <Cluster gap={2}>
        <IconLinkButton href={`${here}?semaine=${addDays(monday, -7)}`} icon="chevronLeft" label="Semaine précédente" />
        <LinkButton href={here} variant={monday === weekStart(today) ? 'ghost' : 'secondary'}>Cette semaine</LinkButton>
        <IconLinkButton href={`${here}?semaine=${addDays(monday, 7)}`} icon="chevronRight" label="Semaine suivante" />
      </Cluster>
      {w.members.length ? (
        <div className={s.tableFrame} tabIndex={0} role="region" aria-label={`Séances du groupe ${w.name}`}>
          <table className={s.teamWeek}>
            <caption className="ds-visually-hidden">Séances du groupe {w.name}, semaine du {day(monday)}, par élève et par jour</caption>
            <thead>
              <tr><th scope="col">Élève</th>{days.map((d) => <th key={d} scope="col" className={d === today ? s.todayCol : undefined}>{formatWeekday(d).slice(0, 3)} {day(d)}</th>)}</tr>
            </thead>
            <tbody>
              {w.members.map((m) => (
                <tr key={m.id}>
                  <th scope="row"><Link href={`${base}/athletes/${m.id}`}>{m.name}</Link>{m.state === 'invited' ? <Text as="span" size="sm" muted> · invité·e</Text> : null}</th>
                  {days.map((d) => {
                    const list = w.items.filter((i) => i.athleteId === m.id && i.localDate === d);
                    return (
                      <td key={d} className={d === today ? s.todayCol : undefined}>
                        {list.map((it) => <Cell key={it.id} it={it} href={it.groupSessionId && it.status !== 'published' ? `${base}/groups/${tid}/sessions/${it.groupSessionId}` : `${base}/athletes/${m.id}/workouts/${it.id}`} />)}
                        {!list.length ? <span className={s.none} aria-label="Aucune séance">·</span> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState icon="users" title="Aucun élève suivi dans ce groupe" action={<LinkButton href={`${base}/athletes?team=${tid}`} variant="primary">Ajouter des élèves</LinkButton>} />}
      <Text size="sm" muted>L’icône de groupe marque une séance créée pour le groupe. Un brouillon de groupe ouvre la séance de groupe pour l’adapter ou la publier.</Text>
    </Stack>
  );
}
