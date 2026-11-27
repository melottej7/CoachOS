import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { athleteContext } from '@/server/repo/context';
import { athleteInbox } from '@/server/repo/messages';
import { unreadNotificationCount } from '@/server/commands/notifications';
import { workspaceAlert } from '@/server/commands/workspace-offer';
import { BillingAlert } from '@/views/billing-alert';
import { logoUrl } from '@/components/coach-card';
import { TourHost } from '@/components/tour-host';
import { AppHeader, AthleteColumn, AthleteShell, Avatar, BellLink, BrandName, HelpLink, ProfileLink } from '@/design';
import { TabBar, type TabItem } from '@/design/nav';

/**
 * Espace élève, direction « Chrono » (D-128, D-129) : en-tête compact aux couleurs du coach, quatre onglets
 * (le profil passe par l’avatar). Lectures en parallèle : l’écran ne s’attend plus lui-même.
 */
export default async function AthleteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await athleteContext(actor.userId, wid);
  if (!ctx) notFound();
  const base = `/athlete/${wid}`;
  const [ws, inbox, notifs, billing] = await Promise.all([
    readWorkspacePublic(actor.userId, wid),
    athleteInbox(actor.userId, wid, ctx.athlete.id),
    unreadNotificationCount(actor.userId, wid),
    workspaceAlert(actor.userId, wid), // D-188
  ]);
  const unread = inbox.reduce((n, e) => n + e.unread, 0);
  const logo = ws ? logoUrl(ws) : null;
  const tabs: TabItem[] = [
    { href: `${base}/today`, label: 'Aujourd’hui', icon: 'home', tour: 'tab-today' },
    { href: `${base}/schedule`, label: 'Programme', icon: 'calendar', also: [`${base}/workouts`], tour: 'tab-schedule' },
    { href: `${base}/progress`, label: 'Progression', icon: 'chart', tour: 'tab-progress' },
    { href: `${base}/messages`, label: 'Échanges', icon: 'chat', count: unread, tour: 'tab-messages' },
  ];
  return (
    <AthleteShell accent={ws?.profile?.accent ?? 'emerald'}>
      <AppHeader home={`${base}/today`} roots={tabs.map(({ href, also }) => ({ href, also }))} except={['/suivre']} brand={<><Avatar name={ctx.workspace.name} coach src={logo} size={32} /><BrandName>{ctx.workspace.name}</BrandName></>}>
        <HelpLink href={`${base}/aide`} />
        <BellLink href={`${base}/notifications`} unread={notifs} />
        <ProfileLink href={`${base}/setup`} label={`Mon profil, ${ctx.athlete.displayName}`} tour="tab-profile"><Avatar name={ctx.athlete.displayName} size={34} /></ProfileLink>
      </AppHeader>
      <AthleteColumn>
        <TabBar label="Espace élève" items={tabs} />
        <main id="contenu">
          {billing ? <BillingAlert s={billing} role="athlete" wid={wid} timeZone={ctx.athlete.timeZone} /> : null}
          {children}
        </main>
      </AthleteColumn>
      <TourHost space="athlete" wid={wid} />
    </AthleteShell>
  );
}
