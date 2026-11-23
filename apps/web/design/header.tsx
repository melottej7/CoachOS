import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './icons';
import s from './nav.module.css';

/** En-tête compact d’un espace : marque à gauche (lien d’accueil), actions à droite. */
export function AppHeader({ brand, home, children }: { brand: ReactNode; home: string; children?: ReactNode }) {
  return (
    <header className={s.header}>
      <Link href={home} className={s.brand}>{brand}</Link>
      <div className={s.headerActions}>{children}</div>
    </header>
  );
}

export function BrandName({ children }: { children: ReactNode }) {
  return <span className={s.brandName}>{children}</span>;
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
