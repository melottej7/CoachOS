'use client';

import { useEffect, useRef, useState } from 'react';

// Colonnes par semaine, type jauge (D-037) : fond = prévu (teinte claire), plein = réalisé (accent).
// Une seule teinte : pas de palette catégorielle. Survol ou focus clavier : bulle d’info ; tableau équivalent à côté.

export interface WeekBar { key: string; label: string; plannedMin: number; doneMin: number; detail: string }

const W = 44; // pas horizontal
const BAR = 20; // largeur ≤ 24 px
const H = 150; // hauteur de tracé

/** Colonne à extrémité arrondie (4 px), carrée sur la ligne de base. */
function column(x: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(4, h);
  const y = H - h;
  return `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + BAR - r} Q${x + BAR},${y} ${x + BAR},${y + r} V${H} Z`;
}

/** `unit` : minutes (graduations en heures) ou points de charge (D-121). */
export function WeeklyChart({ bars, title, unit = 'minutes', legend }: { bars: WeekBar[]; title: string; unit?: 'minutes' | 'points'; legend?: { track?: string; fill: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = unit === 'points';
  const max = Math.max(points ? 100 : 60, ...bars.map((b) => Math.max(b.plannedMin, b.doneMin)));
  const step = points ? (max > 2000 ? 500 : max > 800 ? 250 : 100) : max > 600 ? 180 : max > 300 ? 120 : 60; // graduations rondes
  const top = Math.ceil(max / step) * step;
  const y = (min: number) => (min / top) * H;
  const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
  const width = bars.length * W + 36;
  const active = hover === null ? null : bars[hover];
  // Sur petit écran, le graphique défile : on montre d’abord les semaines les plus récentes.
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = frame.current;
    if (f) f.scrollLeft = f.scrollWidth;
  }, [bars.length]);
  return (
    <figure className="wchart" aria-label={title}>
      <div className="wchart-legend" aria-hidden="true">
        {legend?.track === undefined && !points ? <span><i className="sw track" /> Prévu</span> : legend?.track ? <span><i className="sw track" /> {legend.track}</span> : null}
        <span><i className="sw fill" /> {legend?.fill ?? 'Réalisé'}</span>
      </div>
      <div className="wchart-frame" ref={frame}>
        <svg viewBox={`0 -8 ${width} ${H + 34}`} className="wchart-svg" style={{ minWidth: bars.length * 30 + 36 }} role="img" aria-label={`${title}. Détail dans le tableau ci-dessous.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={34} x2={width} y1={H - y(t)} y2={H - y(t)} className="wchart-grid" />
              <text x={30} y={H - y(t) + 4} className="wchart-tick" textAnchor="end">{t ? (points ? String(t) : `${t / 60} h`) : '0'}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const x = 36 + i * W + (W - BAR) / 2;
            return (
              <g key={b.key} className={`wchart-col${hover === i ? ' on' : ''}`} tabIndex={0} role="button" aria-label={b.detail}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <rect x={36 + i * W} y={0} width={W} height={H + 24} className="wchart-hit" />
                <path d={column(x, y(b.plannedMin))} className="wchart-track" />
                <path d={column(x, y(b.doneMin))} className="wchart-fill" />
                <text x={x + BAR / 2} y={H + 18} className="wchart-x" textAnchor="middle">{b.label}</text>
              </g>
            );
          })}
        </svg>
        {active ? (() => {
          // Bulle gardée dans le cadre : alignée à gauche, centrée ou à droite selon la colonne.
          const pct = ((36 + (hover ?? 0) * W + W / 2) / width) * 100;
          const shift = pct < 30 ? '0' : pct > 70 ? '-100%' : '-50%';
          return <div className="wchart-tip" role="status" style={{ left: `${pct}%`, transform: `translateX(${shift})` }}>{active.detail}</div>;
        })() : null}
      </div>
    </figure>
  );
}
