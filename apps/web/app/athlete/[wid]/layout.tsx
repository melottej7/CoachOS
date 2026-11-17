import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { athleteContext } from '@/server/repo/context';
import { NavLink } from '@/components/nav-link';
import { TopBar } from '@/components/ui';

/** Espace athlète, conçu pour le téléphone. Relation et fuseau visibles. */
export default async function AthleteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const base = `/athlete/${wid}`;
  return (
    <>
      <TopBar home={`${base}/today`}>
        <span>{ctx.athlete.displayName} · {ctx.workspace.name}</span>
      </TopBar>
      <div className="athlete-zone">
        <nav className="tabbar" aria-label="Espace athlète">
          <NavLink href={`${base}/today`} match={`${base}/today`}>Aujourd’hui</NavLink>
          <NavLink href={`${base}/schedule`} match={`${base}/schedule`}>Programme</NavLink>
        </nav>
        <main id="contenu">{children}</main>
      </div>
    </>
  );
}
