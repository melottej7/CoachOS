import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, formatShortDate, formatWeekday, todayIn } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { portfolio } from '@/server/repo/portfolio';
import { groupSessions } from '@/server/repo/group-sessions';
import { Badge, Cluster, EmptyState, Heading, LinkButton, Stack, Text } from '@/design';
import s from '@/views/coach/calendar/calendar.module.css';

export const metadata = { title: 'Séances de groupe' };

const short = (d: string) => `${formatWeekday(d)} ${formatShortDate(d).replace(/\.$/, '')}`;

/** Lot G2 (D-042), refonte Chrono (D-146) : une séance pour tout un groupe, puis adaptations et publication par élève. */
export default async function GroupSessionsPage({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const today = todayIn(ctx.workspace.timeZone);
  const [{ teams }, sessions] = await Promise.all([portfolio(actor.userId, wid, ctx.workspace.timeZone), groupSessions(actor.userId, wid, null, addDays(today, -7))]);
  const base = `/coach/${wid}`;
  const active = teams.filter((t) => !t.archived);
  return (
    <Stack gap={8}>
      <Stack gap={1}>
        <Heading level={1} size={1}>Séances de groupe</Heading>
        <Text muted>Une base commune pour tout un groupe : un brouillon par élève, à adapter si besoin, puis une publication que tu valides.</Text>
      </Stack>
      <Stack as="section" gap={3} aria-labelledby="gs-teams">
        <Heading level={2} size={4} id="gs-teams">Préparer pour un groupe</Heading>
        {active.length ? (
          <ul className={s.rows}>
            {active.map((t) => (
              <li key={t.id}>
                <span className={s.rowText}>
                  <span className={s.rowTitle}>{t.name}</span>
                  <span className={s.rowMeta}>{t.members} élève{t.members > 1 ? 's' : ''}</span>
                </span>
                {t.members ? (
                  <Cluster gap={2}>
                    <LinkButton href={`${base}/groups/${t.id}/week`} size="sm">Semaine du groupe</LinkButton>
                    <LinkButton href={`${base}/groups/${t.id}/sessions/new`} size="sm" variant="primary" icon="plus">Séance pour le groupe</LinkButton>
                  </Cluster>
                ) : <LinkButton href={`${base}/athletes?team=${t.id}`} size="sm" variant="ghost">Ajouter des élèves au groupe</LinkButton>}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon="users" title="Aucun groupe pour l’instant" action={<LinkButton href={`${base}/athletes`} variant="primary">Créer un groupe dans Élèves</LinkButton>}>Un groupe permet de préparer une séance une fois pour plusieurs élèves.</EmptyState>}
      </Stack>
      <Stack as="section" gap={3} aria-labelledby="gs-list">
        <Heading level={2} size={4} id="gs-list">Récentes et à venir</Heading>
        {sessions.length ? (
          <ul className={s.rows}>
            {sessions.map((g) => (
              <li key={g.id}>
                <span className={s.rowText}>
                  <Link className={s.rowTitle} href={`${base}/groups/${g.teamId}/sessions/${g.id}`}>{short(g.localDate)} · {g.title}</Link>
                  <span className={s.rowMeta}>{g.teamName}</span>
                </span>
                {g.published === g.total ? <Badge tone="success">Publiée pour {g.total}</Badge> : <Badge tone="warning">{g.published} sur {g.total} publiée{g.published > 1 ? 's' : ''}</Badge>}
              </li>
            ))}
          </ul>
        ) : <EmptyState icon="calendar" title="Aucune séance de groupe pour l’instant">Choisis un groupe ci-dessus pour en préparer une.</EmptyState>}
      </Stack>
    </Stack>
  );
}
