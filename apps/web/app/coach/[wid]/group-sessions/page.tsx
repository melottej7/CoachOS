import Link from 'next/link';
import { notFound } from 'next/navigation';
import { addDays, formatShortDate, formatWeekday, todayIn } from '@coachos/domain';
import { requireActor } from '@/server/auth/session';
import { coachContext } from '@/server/repo/context';
import { portfolio } from '@/server/repo/portfolio';
import { groupSessions } from '@/server/repo/group-sessions';
import { Pill } from '@/components/ui';

export const metadata = { title: 'Séances de groupe' };

const short = (d: string) => `${formatWeekday(d)} ${formatShortDate(d).replace(/\.$/, '')}`;

/** Lot G2 (D-042) : une séance pour tout un groupe, puis adaptations et publication par élève. */
export default async function GroupSessionsPage({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const today = todayIn(ctx.workspace.timeZone);
  const { roster, teams } = await portfolio(actor.userId, wid, ctx.workspace.timeZone);
  const sessions = await groupSessions(actor.userId, wid, null, addDays(today, -7));
  const base = `/coach/${wid}`;
  const active = teams.filter((t) => !t.archived);
  return (
    <>
      <div className="head"><div><div className="kicker">Séances</div><h1>Séances de groupe</h1>
        <p className="sub">Une base commune pour tout un groupe : un brouillon par élève, à adapter si besoin, puis une publication que tu valides.</p></div></div>
      <section className="card" aria-labelledby="gs-teams">
        <div className="card-head"><h2 id="gs-teams">Préparer pour un groupe</h2></div>
        {active.length ? (
          <ul className="plain list-rows">
            {active.map((t) => (
              <li key={t.id} className="gs-team">
                <span><strong>{t.name}</strong> <span className="muted">· {t.members} élève{t.members > 1 ? 's' : ''}</span></span>
                <span className="actions">
                {t.members ? <Link className="btn small" href={`${base}/groups/${t.id}/week`}>Semaine du groupe</Link> : null}
                {t.members ? <Link className="btn small primary" href={`${base}/groups/${t.id}/sessions/new`}>📅 Nouvelle séance pour le groupe</Link>
                  : <Link className="link-btn" href={`${base}/athletes?team=${t.id}`}>Ajouter des élèves au groupe</Link>}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="empty">Aucun groupe pour l’instant. <Link href={`${base}/athletes`}>Crée un groupe dans Élèves</Link>.</p>}
      </section>
      <section className="card" aria-labelledby="gs-list">
        <div className="card-head"><h2 id="gs-list">Séances de groupe récentes et à venir</h2></div>
        {sessions.length ? (
          <ul className="plain list-rows">
            {sessions.map((g) => (
              <li key={g.id}>
                <Link href={`${base}/groups/${g.teamId}/sessions/${g.id}`}>{short(g.localDate)} · {g.title}</Link>
                <span className="muted"> · {g.teamName}</span>{' '}
                {g.published === g.total ? <Pill>Publiée pour {g.total}</Pill> : <Pill tone="attn">{g.published} sur {g.total} publiée{g.published > 1 ? 's' : ''}</Pill>}
              </li>
            ))}
          </ul>
        ) : <p className="empty">Aucune séance de groupe pour l’instant.</p>}
      </section>
    </>
  );
}
