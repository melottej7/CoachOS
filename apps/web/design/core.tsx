import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import s from './core.module.css';

type Gap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10;
type Align = 'start' | 'end' | 'baseline' | 'center';
const ALIGN = { start: s.alignStart, end: s.alignEnd, baseline: s.alignBaseline, center: undefined } as const;

interface LayoutProps extends HTMLAttributes<HTMLElement> { as?: ElementType; gap?: Gap; children?: ReactNode }

/** Pile verticale avec un espacement constant. */
export function Stack({ as: As = 'div', gap = 4, className, ...rest }: LayoutProps) {
  return <As className={cx(s.stack, s[`g${gap}`], className)} {...rest} />;
}

/** Ligne qui passe à la ligne si besoin ; `between` écarte ses enfants, `grow` les partage. */
export function Cluster({ as: As = 'div', gap = 3, between, nowrap, grow, align, className, ...rest }:
  LayoutProps & { between?: boolean; nowrap?: boolean; grow?: boolean; align?: Align }) {
  return <As className={cx(s.cluster, s[`g${gap}`], between && s.between, nowrap && s.nowrap, grow && s.grow, align && ALIGN[align], className)} {...rest} />;
}

/** Grille de colonnes égales (`cols`) ou automatique (`min` en px). */
export function Grid({ as: As = 'div', gap = 4, cols, min, className, style, ...rest }: LayoutProps & { cols?: number; min?: number }) {
  const vars = { ...(cols ? { '--cols': cols } : {}), ...(min ? { '--min': `${min}px` } : {}), ...style } as CSSProperties;
  return <As className={cx(min ? s.gridAuto : s.grid, s[`g${gap}`], className)} style={vars} {...rest} />;
}

/** Titre en Barlow Condensed. `level` règle la balise, `size` l’apparence. */
export function Heading({ level = 2, size, className, children, ...rest }: { level?: 1 | 2 | 3 | 4; size?: 1 | 2 | 3 | 4 } & HTMLAttributes<HTMLHeadingElement>) {
  const Tag = `h${level}` as 'h1';
  return <Tag className={cx(s.display, s[`h${size ?? level}`], className)} {...rest}>{children}</Tag>;
}

/** Petite ligne en capitales au-dessus d’un titre (date, contexte). */
export function Eyebrow({ tone, as: As = 'p', className, ...rest }: { tone?: 'coach' | 'signal'; as?: ElementType } & HTMLAttributes<HTMLElement>) {
  return <As className={cx(s.eyebrow, tone === 'coach' && s.eyebrowAccent, tone === 'signal' && s.eyebrowSignal, className)} {...rest} />;
}

/** Texte courant. */
export function Text({ as: As = 'p', size, muted, strong, prose, tabular, tone, className, ...rest }:
  { as?: ElementType; size?: 'sm' | 'md' | 'lg'; muted?: boolean; strong?: boolean; prose?: boolean; tabular?: boolean; tone?: 'danger' | 'success' } & HTMLAttributes<HTMLElement>) {
  const sz = size === 'sm' ? s.textSm : size === 'md' ? s.textMd : size === 'lg' ? s.textLg : s.text;
  return <As className={cx(sz, muted && s.muted, strong && s.strong, prose && s.prose, tabular && s.tabular, tone && s[`text-${tone}`], className)} {...rest} />;
}

/** Grand chiffre tabulaire façon tableau d’affichage, avec son unité. */
export function Numeric({ value, unit, size = 40, className }: { value: ReactNode; unit?: string; size?: number; className?: string }) {
  return <span className={cx(s.numeric, className)} style={{ fontSize: size }}>{value}{unit ? <span className={s.numericUnit}>{unit}</span> : null}</span>;
}

/** Surface. `tinted` prend la couleur douce du coach ; `href` en fait un lien entier. */
export function Card({ as: As = 'div', pad = 4, tinted, className, ...rest }:
  { as?: ElementType; pad?: 3 | 4 | 5 | 6; tinted?: boolean } & HTMLAttributes<HTMLElement>) {
  return <As className={cx(s.card, s[`pad${pad}`], tinted && s.cardTinted, className)} {...rest} />;
}

export function Divider() {
  return <hr className={s.divider} />;
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'signal' | 'coach';

/** Pastille d’état : la couleur double toujours un mot. */
export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return <span className={cx(s.badge, s[`tone-${tone}`], dot && s.badgeDot, className)}>{children}</span>;
}

/** Touche de clavier (raccourci). */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

/** Initiales d’une personne, ou logo carré du coach. */
export function Avatar({ name, size = 36, coach, src }: { name: string; size?: number; coach?: boolean; src?: string | null }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return (
    <span className={cx(s.avatar, coach && s.avatarCoach)} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

/** Texte réservé aux lecteurs d’écran. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="ds-visually-hidden">{children}</span>;
}
