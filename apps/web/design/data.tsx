import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';
import s from './data.module.css';

export interface StatItem { label: string; value: ReactNode; unit?: string; sub?: ReactNode; trend?: { up: boolean; text: string } }

/** Rangée de chiffres façon tableau d’affichage. */
export function Stats({ items, size = 34 }: { items: StatItem[]; size?: number }) {
  return (
    <dl className={s.stats} style={{ '--n': items.length, '--size': `${size}px` } as CSSProperties}>
      {items.map((x) => (
        <div key={x.label} className={s.stat}>
          <dt className={s.statLabel}>{x.label}</dt>
          <dd className={s.statValue}>{x.value}{x.unit ? <span className={s.statUnit}>{x.unit}</span> : null}</dd>
          {x.sub ? <dd className={s.statSub}>{x.sub}</dd> : null}
          {x.trend ? <dd className={cx(s.statSub, x.trend.up ? s.up : s.down)}>{x.trend.up ? '↑' : '↓'} {x.trend.text}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Jauge horizontale. Décorative : la valeur est toujours écrite à côté. */
export function Meter({ value, tone = 'coach' }: { value: number; tone?: 'coach' | 'signal' | 'ink' }) {
  return (
    <span className={cx(s.meter, tone === 'signal' && s.meterSignal, tone === 'ink' && s.meterInk)} aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export interface KpiItem { label: string; value: ReactNode; sub?: ReactNode; meter?: number; delta?: { dir: 'up' | 'down' | 'flat'; text: string } }

/**
 * Grille d’indicateurs (progression) : la valeur en grand, ce qu’elle mesure, et l’écart avec la période d’avant,
 * dont le sens est écrit en toutes lettres (la flèche n’est qu’un appui visuel).
 */
export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <dl className={s.kpis}>
      {items.map((k) => (
        <div key={k.label} className={s.kpi}>
          <dt className={s.statLabel}>{k.label}</dt>
          <dd className={s.kpiValue}>{k.value}</dd>
          {k.meter !== undefined ? <dd><Meter value={k.meter} /></dd> : null}
          {k.sub ? <dd className={s.statSub}>{k.sub}</dd> : null}
          {k.delta ? (
            <dd className={cx(s.kpiDelta, k.delta.dir === 'up' && s.deltaUp, k.delta.dir === 'down' && s.deltaDown)}>
              <span aria-hidden="true">{k.delta.dir === 'up' ? '↑' : k.delta.dir === 'down' ? '↓' : '→'} </span>{k.delta.text}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export interface Fact { label: ReactNode; value: ReactNode }

/** Liste de faits « libellé : valeur » (ce que l’élève a déclaré, détails d’une séance). Une ligne par fait. */
export function Facts({ items }: { items: Fact[] }) {
  return (
    <dl className={s.facts}>
      {items.map((f, i) => (
        <div key={i} className={s.fact}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
