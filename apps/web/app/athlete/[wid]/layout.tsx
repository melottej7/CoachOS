import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { athleteContext } from '@/server/repo/context';
import { athleteInbox } from '@/server/repo/messages';
import { CoachLogo } from '@/components/coach-card';
import { NavLink } from '@/components/nav-link';
import { TopBar } from '@/components/ui';
import { TourHost } from '@/components/tour-host';

/** Espace athlète, conçu pour le téléphone. Relation et fuseau visibles. */
export default async function AthleteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const base = `/athlete/${wid}`;
  const ws = await readWorkspacePublic(actor.userId, wid);
  const unread = (await athleteInbox(actor.userId, wid, ctx.athlete.id)).reduce((n, e) => n + e.unread, 0);
  return (
    <>
      <TopBar home={`${base}/today`}>
        <span className="actions" style={{ gap: 6 }}>
          <a href={`${base}/setup`} style={{ color: 'inherit' }}>{actor.displayName}</a> ·
          <a href={`${base}/coach`} style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {ws ? <CoachLogo data={ws} small /> : null}{ctx.workspace.name}
          </a>
        </span>
      </TopBar>
      <div className="athlete-zone" data-accent={ws?.profile?.accent ?? 'emerald'}>
        <nav className="tabbar" aria-label="Espace athlète">
          <NavLink href={`${base}/today`} match={`${base}/today`} tour="tab-today">Aujourd’hui</NavLink>
          <NavLink href={`${base}/schedule`} match={`${base}/schedule`} tour="tab-schedule">Programme</NavLink>
          <NavLink href={`${base}/messages`} match={`${base}/messages`} tour="tab-messages">
            Échanges {unread ? <span className="count" aria-label={`${unread} non lu${unread > 1 ? 's' : ''}`}>{unread}</span> : null}
          </NavLink>
          <NavLink href={`${base}/setup`} match={`${base}/setup`} tour="tab-profile">Profil</NavLink>
        </nav>
        <main id="contenu">{children}</main>
        <TourHost space="athlete" wid={wid} />
      </div>
    </>
  );
}
