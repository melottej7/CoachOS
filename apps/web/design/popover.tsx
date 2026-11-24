'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';
import s from './popover.module.css';

/**
 * Menu ou petit formulaire qui s’ouvre sous un bouton (plus d’actions, reporter, créneau). Bouton natif (summary),
 * fermé par Échap (le focus revient au bouton), un clic ailleurs, ou `close()` passé aux enfants.
 * `iconOnly` : bouton carré avec un nom obligatoire (`label`).
 */
export function Popover({ label, icon, iconOnly, text, align = 'end', children }:
  { label: string; icon?: IconName; iconOnly?: boolean; text?: ReactNode; align?: 'start' | 'end'; children: (close: () => void) => ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => { if (ref.current) ref.current.open = false; };
  useEffect(() => {
    const onEvent = (e: Event) => {
      const d = ref.current;
      if (!d?.open) return;
      // Chemin du clic tel qu’il était au moment du clic : un élément du menu remplacé pendant le clic (étape suivante
      // d’un petit formulaire) compte encore comme « dedans » (D-158).
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !e.composedPath().includes(d)) {
        d.open = false;
        if (e instanceof KeyboardEvent) d.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('click', onEvent);
    document.addEventListener('keydown', onEvent);
    return () => { document.removeEventListener('click', onEvent); document.removeEventListener('keydown', onEvent); };
  }, []);
  return (
    <details ref={ref} className={s.popover}>
      <summary className={cx(s.trigger, iconOnly && s.iconOnly)} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined}>
        {icon ? <Icon name={icon} size={16} /> : null}{iconOnly ? null : (text ?? label)}
      </summary>
      <div className={cx(s.panel, align === 'start' ? s.start : s.end)}>{children(close)}</div>
    </details>
  );
}

/** Ligne d’action dans un menu. */
export function MenuItem({ onClick, icon, tone, children, disabled }: { onClick: () => void; icon?: IconName; tone?: 'danger'; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={cx(s.item, tone === 'danger' && s.danger)} onClick={onClick} disabled={disabled}>
      {icon ? <Icon name={icon} size={16} /> : null}{children}
    </button>
  );
}
