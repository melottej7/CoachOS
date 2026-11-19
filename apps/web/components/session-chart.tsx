'use client';

import { useState, type KeyboardEvent } from 'react';
import { formatClock, type ProfileBar } from '@coachos/domain';

// CE-E-04 (D-040) : la forme de la séance d’un coup d’œil. Largeur = durée, hauteur = intensité (1 à 7).
// Une seule teinte, plus foncée quand c’est plus intense (la hauteur porte déjà l’information) ; récupération en gris.
// Toucher, survol ou flèches du clavier : détail de l’étape ; tableau équivalent.

const W = 600;
const H = 112; // hauteur de tracé
const GAP = 2;

function column(x: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  const y = H - h;
  return `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${H} Z`;
}

const minutes = (s: number) => `${Math.round(s / 60)}'`;

export function SessionChart({ bars }: { bars: ProfileBar[] }) {
  const [sel, setSel] = useState<number | null>(null);
  if (!bars.length) return null;
  const total = bars.reduce((n, b) => n + b.seconds, 0);
  const sx = W / total;
  let acc = 0;
  const geo = bars.map((b) => {
    const x = acc * sx;
    acc += b.seconds;
    return { x, w: Math.max(1.5, b.seconds * sx - GAP), h: (b.level / 7) * H };
  });
  const tickStep = [300, 600, 900, 1800, 3600].find((s) => total / s <= 5) ?? 7200;
  const ticks = Array.from({ length: Math.floor(total / tickStep) + 1 }, (_, k) => k * tickStep).filter((t) => total - t > tickStep * 0.6);
  const cur = sel === null ? null : bars[sel] ?? null;
  const approx = bars.some((b) => b.secondsApprox);
  const move = (d: number) => setSel((s) => (s === null ? (d > 0 ? 0 : bars.length - 1) : Math.max(0, Math.min(bars.length - 1, s + d))));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setSel(0); }
    else if (e.key === 'End') { e.preventDefault(); setSel(bars.length - 1); }
  };
  const tone = (b: ProfileBar) => (b.phase === 'recovery' || b.phase === 'rest' ? 'sc-rec' : `sc-l${b.level}`);

  return (
    <figure className="sc" aria-label="Forme de la séance">
      <div className="sc-frame" tabIndex={0} role="group" onKeyDown={onKey}
        aria-label={`Forme de la séance : ${bars.length} étapes, ${formatClock(total)}${approx ? ' environ' : ''}. Flèches gauche et droite pour parcourir les étapes ; détail ci-dessous.`}>
        <div className="sc-plot">
        <svg viewBox={`0 -4 ${W} ${H + 4}`} className="sc-svg" aria-hidden="true" preserveAspectRatio="none">
          {[3, 5].map((z) => (
            <g key={z}>
              <line x1={0} x2={W} y1={H - (z / 7) * H} y2={H - (z / 7) * H} className="sc-guide" />
            </g>
          ))}
          {bars.map((b, i) => (
            <path key={b.index} d={column(geo[i]!.x, geo[i]!.w, geo[i]!.h)}
              className={`sc-bar ${tone(b)}${b.levelKnown ? '' : ' unknown'}${sel === i ? ' on' : ''}`}
              onPointerEnter={() => setSel(i)} onClick={() => setSel(i)} />
          ))}
          <line x1={0} x2={W} y1={H} y2={H} className="sc-base" />
        </svg>
        <div className="sc-zlabels" aria-hidden="true">
          {[3, 5].map((z) => <span key={z} style={{ bottom: `${((z / 7) * H / (H + 4)) * 100}%` }}>Z{z}</span>)}
        </div>
        </div>
        <div className="sc-axis" aria-hidden="true">
          {ticks.map((t) => <span key={t} style={{ left: `${(t / total) * 100}%` }}>{t ? minutes(t) : '0'}</span>)}
          <span className="end" style={{ left: '100%' }}>{minutes(total)}</span>
        </div>
      </div>
      <div className="sc-detail" aria-live="polite">
        {cur ? (
          <>
            <div>
              <p className="sc-detail-title">{cur.label}</p>
              <p className="sc-detail-sub">
                {[cur.repeat, cur.timed ? null : cur.secondsApprox ? 'durée non estimée' : `environ ${formatClock(cur.seconds)}`, cur.levelKnown ? null : 'intensité non précisée']
                  .filter(Boolean).join(' · ') || `Étape ${cur.index + 1} sur ${bars.length}`}
              </p>
            </div>
            <span className="sc-nav">
              <button type="button" className="icon-btn" aria-label="Étape précédente" disabled={sel === 0} onClick={() => move(-1)}>‹</button>
              <button type="button" className="icon-btn" aria-label="Étape suivante" disabled={sel === bars.length - 1} onClick={() => move(1)}>›</button>
            </span>
          </>
        ) : <p className="sc-hint">Touche une barre pour voir l’étape. Plus la barre est haute, plus c’est intense ; en gris, la récupération.</p>}
      </div>
      <details className="sc-table">
        <summary>Voir le tableau</summary>
        <table>
          <caption className="visually-hidden">Étapes de la séance dans l’ordre</caption>
          <thead><tr><th scope="col">#</th><th scope="col">Étape</th><th scope="col">Durée</th><th scope="col">Intensité</th></tr></thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.index}>
                <td>{b.index + 1}</td>
                <td>{b.label}{b.repeat ? ` (${b.repeat})` : ''}</td>
                <td>{b.secondsApprox ? '—' : formatClock(b.seconds)}</td>
                <td>{b.levelKnown ? `${b.level} sur 7` : 'non précisée'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {approx ? <p className="sc-note">Largeur approximative pour les étapes en distance sans allure connue.</p> : null}
    </figure>
  );
}
