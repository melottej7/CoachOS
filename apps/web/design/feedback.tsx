import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';
import s from './feedback.module.css';

type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'coach';
const ICON: Record<BannerTone, IconName> = { info: 'info', success: 'check', warning: 'alert', danger: 'alert', coach: 'info' };

/** Message en ligne. Les erreurs sont annoncées immédiatement (role alert), le reste poliment (role status). */
export function Banner({ tone = 'info', title, action, children }: { tone?: BannerTone; title?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cx(s.banner, s[tone])} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={ICON[tone]} size={20} />
      <div className={s.bannerBody}>{title ? <strong>{title}</strong> : null}{children ? <span>{children}</span> : null}</div>
      {action ? <div className={s.bannerAction}>{action}</div> : null}
    </div>
  );
}

/** État vide : dit pourquoi c’est vide et ce qu’on peut faire. */
export function EmptyState({ icon = 'calendar', title, children, action }: { icon?: IconName; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <Icon name={icon} size={28} />
      <p className={s.emptyTitle}>{title}</p>
      {children ? <p>{children}</p> : null}
      {action ? <div className={s.emptyAction}>{action}</div> : null}
    </div>
  );
}

/** Forme grise animée pendant le chargement. */
export function Skeleton({ width = '100%', height = 16, radius }: { width?: number | string; height?: number | string; radius?: number }) {
  return <span className={s.skeleton} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/** Message bref en bas de l’écran, avec une action (souvent « Annuler »). À utiliser depuis un composant client. */
export function Toast({ children, action }: { children: ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className={s.toast} role="status">
      <span>{children}</span>
      {action ? <button type="button" className={s.toastAction} onClick={action.onClick}>{action.label}</button> : null}
    </div>
  );
}
