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
