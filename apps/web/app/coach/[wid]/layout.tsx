import { notFound } from 'next/navigation';
import { requireActor } from '@/server/auth/session';
import { readWorkspacePublic } from '@/server/commands/workspace-profile';
import { openReviewCount } from '@/server/repo/coach';
import { coachContext } from '@/server/repo/context';
import { coachInbox } from '@/server/repo/messages';
import { isSimpleMode } from '@/server/simple-mode';
import { unreadNotificationCount } from '@/server/commands/notifications';
import { workspaceAlert } from '@/server/commands/workspace-offer';
import { BillingAlert } from '@/views/billing-alert';
import { logoUrl } from '@/components/coach-card';
import { TourHost } from '@/components/tour-host';
import { AccountMenu, AppHeader, Avatar, BottomNav, BrandName, CoachRail, CoachShell, RailBrand, type MenuEntry, type NavItem } from '@/design';
import { CommandPalette, PaletteButton } from '@/views/coach/palette/command-palette';
import { CoachSectionTabs } from '@/views/coach/section-tabs';

/**
 * Espace coach, direction « Chrono » (D-143) : cinq destinations (Accueil, Calendrier, Élèves, Boîte de réception,
 * Bibliothèque), réglages et compte à part. Le contexte est revérifié en base à chaque rendu (wid ne donne aucun droit) ;
 * les comptes de la navigation se lisent en parallèle.
 */
export default async function CoachLayout({ children, params }: { children: React.ReactNode; params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  const actor = await requireActor();
  const ctx = await coachContext(actor.userId, wid);
  if (!ctx) notFound();
  const [pending, inbox, ws, notifs, simple, billing] = await Promise.all([
    openReviewCount(actor.userId, wid),
    coachInbox(actor.userId, wid),
    readWorkspacePublic(actor.userId, wid),
    unreadNotificationCount(actor.userId, wid),
    isSimpleMode(),
    workspaceAlert(actor.userId, wid), // D-188 : rien tant que le paiement n’est pas ouvert
  ]);
  const unread = inbox.reduce((n, e) => n + e.unread, 0);
  const base = `/coach/${wid}`;
  const role = ctx.role === 'owner' ? 'Coach propriétaire' : 'Coach';
  const waiting = pending + unread + notifs;
  const items: NavItem[] = [
    { href: `${base}/planning`, label: 'Accueil', icon: 'home', tour: 'nav-planning' },
    { href: `${base}/calendar`, label: 'Calendrier', icon: 'calendar', also: [`${base}/group-sessions`, `${base}/groups`, `${base}/to-plan`], tour: 'nav-calendar' },
    { href: `${base}/athletes`, label: 'Élèves', icon: 'users', tour: 'nav-athletes' },
    {
      href: `${base}/review`, label: 'Boîte de réception', short: 'Réception', icon: 'inbox', also: [`${base}/messages`, `${base}/notifications`], tour: 'nav-review',
      count: waiting, countLabel: [pending && `${pending} retour${pending > 1 ? 's' : ''} à traiter`, unread && `${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}`, notifs && `${notifs} notification${notifs > 1 ? 's' : ''}`].filter(Boolean).join(', '),
    },
    { href: `${base}/library`, label: 'Bibliothèque', icon: 'library', also: [`${base}/exercises`, `${base}/methode`], tour: 'nav-library' },
  ];
  const entries: MenuEntry[] = [
    { href: `${base}/settings`, label: 'Paramètres de l’espace', icon: 'settings' },
    { href: '/profile', label: 'Mon compte', icon: 'user' },
    { href: '/choose-workspace', label: 'Changer d’espace', icon: 'arrowRight' },
    { href: `${base}/planning?tour=start`, label: 'Revoir la visite guidée', icon: 'info', tour: 'tour-relaunch' },
  ];
  const mark = <Avatar name={ctx.workspace.name} coach src={ws ? logoUrl(ws) : null} size={36} />;
  return (
    <CoachShell
      accent={ws?.profile?.accent ?? 'emerald'}
      rail={(
        <CoachRail label="Espace coach" items={items}
          brand={<><RailBrand href={`${base}/planning`} mark={mark} name={ctx.workspace.name} role={role} /><PaletteButton variant="rail" /></>}
          footer={[{ href: `${base}/settings`, label: 'Paramètres', icon: 'settings', tour: 'nav-settings' }]}
          account={(
            <AccountMenu variant="rail" placement="up" name={actor.displayName} role={role} entries={entries} signOut="/auth/signout" tour="account-menu"
              trigger={<><Avatar name={actor.displayName} size={32} /><span>{actor.displayName}</span></>} />
          )} />
      )}
      top={(
        <AppHeader home={`${base}/planning`} roots={items.map(({ href, also }) => ({ href, also }))} brand={<>{mark}<BrandName>{ctx.workspace.name}</BrandName></>}>
          <PaletteButton variant="header" />
          <AccountMenu name={actor.displayName} role={role} entries={entries} signOut="/auth/signout" tour="account-menu"
            trigger={<Avatar name={actor.displayName} size={34} />} />
        </AppHeader>
      )}
      bottom={<BottomNav label="Espace coach" items={items} />}>
      <CoachSectionTabs base={base} strength={ctx.modules.strength} simple={simple} counts={{ review: pending, messages: unread, notifications: notifs }} />
      {billing ? <BillingAlert s={billing} role={ctx.role === 'owner' ? 'owner' : 'coach'} wid={wid} timeZone={ctx.workspace.timeZone} /> : null}
      {children}
      <TourHost space="coach" wid={wid} />
      <CommandPalette wid={wid} owner={ctx.role === 'owner'} strength={ctx.modules.strength} />
    </CoachShell>
  );
}
