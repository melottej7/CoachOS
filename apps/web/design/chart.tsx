'use client';

import { useEffect, useRef, useState } from 'react';
import { cx } from './cx';
import s from './chart.module.css';

/**
 * Colonnes par semaine, façon jauge (D-037, refonte D-134) : fond = prévu (teinte claire), plein = réalisé (couleur du coach).
 * Une seule teinte, grille discrète, extrémités arrondies de 4 px posées sur la ligne de base. Survol ou focus clavier :
 * bulle d’info ; le tableau équivalent est toujours proposé à côté (jamais l’information dans la seule couleur).
 */
export interface ChartBar { key: string; label: string; track: number; fill: number; detail: string }

const W = 44;
const BAR = 20;
const H = 150;

function column(x: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, h);
  const y = H - h;
  return `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + BAR - r} Q${x + BAR},${y} ${x + BAR},${y + r} V${H} Z`;
}

export function WeekBars({ bars, title, unit = 'minutes', legend }: { bars: ChartBar[]; title: string; unit?: 'minutes' | 'points'; legend: { track?: string; fill: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = unit === 'points';
  const max = Math.max(points ? 100 : 60, ...bars.map((b) => Math.max(b.track, b.fill)));
  const step = points ? (max > 2000 ? 500 : max > 800 ? 250 : 100) : max > 600 ? 180 : max > 300 ? 120 : 60;
  const top = Math.ceil(max / step) * step;
  const y = (v: number) => (v / top) * H;
  const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
  const width = bars.length * W + 36;
  const active = hover === null ? null : bars[hover];
  // Sur petit écran, le graphique défile : on montre d’abord les semaines les plus récentes.
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => { const f = frame.current; if (f) f.scrollLeft = f.scrollWidth; }, [bars.length]);
  const pct = hover === null ? 0 : ((36 + hover * W + W / 2) / width) * 100;
  return (
    <figure className={s.chart} aria-label={title}>
      <figcaption className={s.legend} aria-hidden="true">
        {legend.track ? <span><i className={cx(s.swatch, s.swatchTrack)} />{legend.track}</span> : null}
        <span><i className={cx(s.swatch, s.swatchFill)} />{legend.fill}</span>
      </figcaption>
      <div className={s.frame} ref={frame}>
        <svg viewBox={`0 -8 ${width} ${H + 34}`} className={s.svg} style={{ minWidth: bars.length * 30 + 36 }} role="img" aria-label={`${title}. Détail dans le tableau.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={34} x2={width} y1={H - y(t)} y2={H - y(t)} className={s.grid} />
              <text x={30} y={H - y(t) + 4} className={s.tick} textAnchor="end">{t ? (points ? String(t) : `${t / 60} h`) : '0'}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const x = 36 + i * W + (W - BAR) / 2;
            return (
              <g key={b.key} className={cx(s.col, hover === i && s.on)} tabIndex={0} role="button" aria-label={b.detail}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <rect x={36 + i * W} y={0} width={W} height={H + 24} className={s.hit} />
                <path d={column(x, y(b.track))} className={s.track} />
                <path d={column(x, y(b.fill))} className={s.fill} />
                <text x={x + BAR / 2} y={H + 18} className={s.tick} textAnchor="middle">{b.label}</text>
              </g>
            );
          })}
        </svg>
        {active ? (
          <div className={s.tip} role="status" style={{ left: `${pct}%`, transform: `translateX(${pct < 30 ? '0' : pct > 70 ? '-100%' : '-50%'})` }}>{active.detail}</div>
        ) : null}
      </div>
    </figure>
  );
}
