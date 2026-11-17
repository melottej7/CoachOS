import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { openReviewCount } from '@/server/repo/coach';
import { coachContext } from '@/server/repo/context';
import { NavLink } from '@/components/nav-link';
import { TopBar, initials } from '@/components/ui';

/** Espace coach : le contexte est revérifié en base à chaque rendu (wid ne donne aucun droit). */
export default async function CoachLayout({ children, params }: { children: React.ReactNode; params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const pending = await openReviewCount(actor.userId, wid);
  const ws = await readWorkspacePublic(actor.userId, wid);
  const base = `/coach/${wid}`;
  return (
    <>
      <TopBar home={`${base}/calendar`}>
        <span>{ctx.workspace.name} · {ctx.role === 'owner' ? 'Coach propriétaire' : 'Coach'}</span>
      </TopBar>
      <div className="shell" data-accent={ws?.profile?.accent ?? 'emerald'}>
        <aside className="sidebar">
          <div className="account">
            <span className="avatar" aria-hidden="true">{initials(actor.displayName)}</span>
            <div><strong><a href="/profile" style={{ color: 'inherit' }}>{actor.displayName}</a></strong><small>Espace coach</small></div>
          </div>
          <nav aria-label="Espace coach">
            <NavLink className="nav-link" href={`${base}/calendar`} match={`${base}/calendar`}>Planning</NavLink>
            <NavLink className="nav-link" href={`${base}/review`} match={`${base}/review`}>
              Retours {pending ? <span className="count" aria-label={`${pending} à traiter`}>{pending}</span> : null}
            </NavLink>
            <NavLink className="nav-link" href={`${base}/athletes`} match={`${base}/athletes`}>Athlètes</NavLink>
            <NavLink className="nav-link" href={`${base}/settings`} match={`${base}/settings`}>Paramètres</NavLink>
            <NavLink className="nav-link" href={`${base}/welcome`} match={`${base}/welcome`}>Guide</NavLink>
          </nav>
        </aside>
        <main id="contenu" className="main">{children}</main>
      </div>
    </>
  );
}
