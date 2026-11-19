import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { athleteContext } from '@/server/repo/context';
import { athleteInbox } from '@/server/repo/messages';
import { CoachLogo } from '@/components/coach-card';
import { NavLink } from '@/components/nav-link';
import { TopBar } from '@/components/ui';
import { TourHost } from '@/components/tour-host';

/** Icône d’onglet (trait, décorative). */
function TabIcon({ d }: { d: string }) {
  return <svg className="tab-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

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
          <a href={`${base}/setup`} style={{ color: 'inherit' }}>{ctx.athlete.displayName}</a> ·
          <a href={`${base}/coach`} style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {ws ? <CoachLogo data={ws} small /> : null}{ctx.workspace.name}
          </a>
        </span>
      </TopBar>
      <div className="athlete-zone" data-accent={ws?.profile?.accent ?? 'emerald'}>
        <nav className="tabbar" aria-label="Espace athlète">
          <NavLink href={`${base}/today`} match={`${base}/today`} tour="tab-today"><TabIcon d="M4 11l8-7 8 7v9H4z" />Aujourd’hui</NavLink>
          <NavLink href={`${base}/schedule`} match={`${base}/schedule`} also={[`${base}/workouts`]} tour="tab-schedule"><TabIcon d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />Programme</NavLink>
          <NavLink href={`${base}/progress`} match={`${base}/progress`} tour="tab-progress"><TabIcon d="M4 20V10M10 20V4M16 20v-7M22 20H2" />Progression</NavLink>
          <NavLink href={`${base}/messages`} match={`${base}/messages`} tour="tab-messages">
            <TabIcon d="M4 5h16v11H9l-5 4z" />Échanges {unread ? <span className="count" aria-label={`${unread} non lu${unread > 1 ? 's' : ''}`}>{unread}</span> : null}
          </NavLink>
          <NavLink href={`${base}/setup`} match={`${base}/setup`} also={[`${base}/coach`]} tour="tab-profile"><TabIcon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4.5-6 8-6s7 2 8 6" />Profil</NavLink>
        </nav>
        <main id="contenu">{children}</main>
        <TourHost space="athlete" wid={wid} />
      </div>
    </>
  );
}
