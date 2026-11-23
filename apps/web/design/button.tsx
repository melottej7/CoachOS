import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';
import s from './button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'coach';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Look {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
}

function classes({ variant = 'secondary', size = 'md', block }: Look, extra?: string) {
  return cx(s.button, s[variant], size !== 'md' && s[size], block && s.block, extra);
}

function Inner({ icon, iconRight, loading, children }: { icon?: IconName; iconRight?: IconName; loading?: boolean; children?: ReactNode }) {
  return (
    <>
      {loading ? <span className={s.spinner} aria-hidden="true" /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={18} /> : null}
    </>
  );
}

/** Bouton d’action. `loading` le garde désactivé et l’annonce occupé (double clic sans effet). */
export function Button({ variant, size, icon, iconRight, block, loading, className, children, type = 'button', disabled, ...rest }:
  Look & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button type={type} className={classes({ variant, size, block }, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      <Inner icon={icon} iconRight={iconRight} loading={loading}>{children}</Inner>
    </button>
  );
}

/** Lien qui a l’allure d’un bouton (navigation). */
export function LinkButton({ variant, size, icon, iconRight, block, className, children, href, ...rest }:
  Look & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <Link href={href} className={classes({ variant, size, block }, className)} {...rest}>
      <Inner icon={icon} iconRight={iconRight}>{children}</Inner>
    </Link>
  );
}

/** Bouton icône : son nom est obligatoire (lecteurs d’écran). */
export function IconButton({ icon, label, variant = 'ghost', size, className, ...rest }:
  { icon: IconName; label: string; variant?: ButtonVariant; size?: ButtonSize } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" aria-label={label} title={label} className={classes({ variant, size }, cx(s.icon, className))} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 20} />
    </button>
  );
}

/** Lien icône (navigation précédent / suivant) : son nom est obligatoire. */
export function IconLinkButton({ icon, label, variant = 'secondary', size, className, href, ...rest }:
  { icon: IconName; label: string; variant?: ButtonVariant; size?: ButtonSize; href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'>) {
  return (
    <Link href={href} aria-label={label} title={label} className={classes({ variant, size }, cx(s.icon, className))} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 20} />
    </Link>
  );
}

/** Lien simple à l’allure d’un bouton, pour un téléchargement ou une adresse hors de l’application. */
export function AnchorButton({ variant, size, icon, iconRight, block, className, children, ...rest }:
  Look & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a className={classes({ variant, size, block }, className)} {...rest}>
      <Inner icon={icon} iconRight={iconRight}>{children}</Inner>
    </a>
  );
}
