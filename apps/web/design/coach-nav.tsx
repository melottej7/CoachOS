'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';
import s from './coach-nav.module.css';

export interface NavItem { href: string; label: string; short?: string; icon: IconName; count?: number; countLabel?: string; also?: string[]; tour?: string }

function useActive() {
  const path = usePathname() ?? '';
  return (t: { href: string; also?: string[] }) => [t.href, ...(t.also ?? [])].some((p) => path === p || path.startsWith(`${p}/`));
}

/** Barre latérale du coach (ordinateur) : marque de l’espace, destinations, réglages et compte en bas. */
export function CoachRail({ brand, items, footer, account, label }: { brand: ReactNode; items: NavItem[]; footer: NavItem[]; account: ReactNode; label: string }) {
  const active = useActive();
  const link = (t: NavItem) => (
    <Link key={t.href} href={t.href} className={s.railItem} aria-current={active(t) ? 'page' : undefined} data-tour={t.tour}>
      <Icon name={t.icon} size={20} />
      <span>{t.label}</span>
      {t.count ? <span className={s.railCount} aria-label={t.countLabel ?? String(t.count)}>{t.count}</span> : null}
    </Link>
  );
  return (
    <>
      {brand}
      <nav aria-label={label} className={s.railNav}>{items.map(link)}</nav>
      <div className={s.railSpacer} />
      <nav aria-label="Réglages" className={s.railNav}>{footer.map(link)}</nav>
      {account}
    </>
  );
}

/** Marque de l’espace en tête de la barre latérale. */
export function RailBrand({ href, mark, name, role }: { href: string; mark: ReactNode; name: string; role: string }) {
  return (
    <Link href={href} className={s.railBrand}>
      {mark}
      <span className={s.railBrandText}><span className={s.railBrandName}>{name}</span><span className={s.railBrandRole}>{role}</span></span>
    </Link>
  );
}

/** Barre basse du coach (téléphone et tablette) : les cinq destinations. */
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const active = useActive();
  return (
    <nav className={s.bottom} aria-label={label} style={{ '--n': items.length } as CSSProperties}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={s.tab} aria-current={active(t) ? 'page' : undefined} data-tour={t.tour}>
          <Icon name={t.icon} size={22} />
          <span>{t.short ?? t.label}</span>
          {t.count ? <span className={s.tabCount} aria-label={t.countLabel ?? String(t.count)}>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export interface SectionTab { href: string; label: string; count?: number; countLabel?: string; current: boolean; tour?: string }

/** Sous-onglets d’une section (Boîte de réception : Retours, Messages, Notifications…). */
export function SectionTabs({ label, items }: { label: string; items: SectionTab[] }) {
  // Bilan produit : sur téléphone, l’onglet ouvert peut dépasser à droite ; on le ramène au centre de la rangée.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav.current && el && nav.current.scrollWidth > nav.current.clientWidth) {
      nav.current.scrollLeft = Math.max(0, el.offsetLeft - (nav.current.clientWidth - el.offsetWidth) / 2);
    }
  });
  return (
    <nav aria-label={label} className={s.sectionTabs} ref={nav}>
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={s.sectionTab} aria-current={t.current ? 'page' : undefined} data-tour={t.tour}>
          {t.label}
          {t.count ? <span className={s.sectionCount} aria-label={t.countLabel ?? String(t.count)}>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export interface MenuEntry { href: string; label: string; icon: IconName; tour?: string }

/**
 * Menu du compte : qui je suis, réglages, changer d’espace, visite guidée, se déconnecter.
 * Un vrai bouton (summary) l’ouvre ; Échap ou un clic ailleurs le ferme. `up` : s’ouvre vers le haut (bas de la barre latérale).
 */
export function AccountMenu({ trigger, name, role, entries, signOut, placement = 'down', variant = 'plain', tour }:
  { trigger: ReactNode; name: string; role: string; entries: MenuEntry[]; signOut: string; placement?: 'up' | 'down'; variant?: 'plain' | 'rail'; tour?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !d.contains(e.target as Node)) {
        d.open = false;
        if (e instanceof KeyboardEvent) d.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close); };
  }, []);
  // Une navigation referme le menu.
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  return (
    <details ref={ref} className={cx(s.account, variant === 'rail' && s.accountRail)} data-tour={tour}>
      <summary className={s.accountSummary} aria-label={`Menu du compte, ${name}`}>{trigger}</summary>
      <div className={cx(s.accountPanel, placement === 'up' ? s.up : s.down)}>
        <div className={s.menuHead}><strong>{name}</strong><span>{role}</span></div>
        {entries.map((e) => (
          <Link key={e.href} href={e.href} className={s.menuItem} data-tour={e.tour}><Icon name={e.icon} size={18} />{e.label}</Link>
        ))}
        <form action={signOut} method="post">
          <button type="submit" className={s.menuItem}><Icon name="logout" size={18} />Se déconnecter</button>
        </form>
      </div>
    </details>
  );
}
