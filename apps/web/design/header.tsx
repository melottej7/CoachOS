import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { BackLink, type BackRoot } from './back-link';
import { Icon } from './icons';
import s from './nav.module.css';

/**
 * En-tête compact d’un espace : marque à gauche (lien d’accueil), actions à droite.
 * Avec `roots` (les onglets principaux), une flèche de retour s’affiche sur toute page intérieure.
 */
export function AppHeader({ brand, home, roots, except, children }: { brand: ReactNode; home: string; roots?: BackRoot[]; except?: string[]; children?: ReactNode }) {
  return (
    <header className={s.header}>
      <div className={s.headerStart}>
        {roots ? <Suspense fallback={null}><BackLink roots={roots} home={home} except={except} /></Suspense> : null}
        <Link href={home} className={s.brand}>{brand}</Link>
      </div>
      <div className={s.headerActions}>{children}</div>
    </header>
  );
}

export function BrandName({ children }: { children: ReactNode }) {
  return <span className={s.brandName}>{children}</span>;
}

/** D-194 · Aide : un point d’interrogation discret à côté de la cloche. */
export function HelpLink({ href }: { href: string }) {
  return (
    <Link href={href} className={s.bell} aria-label="Aide">
      <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
      </svg>
    </Link>
  );
}

/** Cloche des notifications : un point signale du nouveau, le nombre est annoncé. */
export function BellLink({ href, unread }: { href: string; unread: number }) {
  return (
    <Link href={href} className={s.bell} aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}>
      <Icon name="bell" size={22} />
      {unread ? <span className={s.bellDot} aria-hidden="true" /> : null}
    </Link>
  );
}
