'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Icon, type IconName } from './icons';
import s from './nav.module.css';

export interface TabItem { href: string; label: string; icon: IconName; count?: number; also?: string[]; tour?: string }

/** Onglets de l’élève. L’onglet actif suit l’adresse (et ses sous-pages déclarées dans `also`). */
export function TabBar({ items, label }: { items: TabItem[]; label: string }) {
  const path = usePathname() ?? '';
  const active = (t: TabItem) => [t.href, ...(t.also ?? [])].some((p) => path === p || path.startsWith(`${p}/`));
  return (
    <nav className={s.tabbar} aria-label={label} style={{ '--n': items.length } as CSSProperties}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={s.tab} aria-current={active(t) ? 'page' : undefined} data-tour={t.tour}>
          <Icon name={t.icon} size={22} />
          <span>{t.label}</span>
          {t.count ? <span className={s.count} aria-label={`${t.count} non lu${t.count > 1 ? 's' : ''}`}>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

