import { cx } from './cx';
import s from './zones.module.css';

/**
 * Les 7 zones, signature de la donnée de CoachOS (D-128) : une même couleur par zone dans tout le produit,
 * toujours doublée du libellé « Zn » (jamais la couleur seule). Niveau 0 = intensité inconnue.
 */
export type ZoneLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const zoneClass = (z: number) => s[`z${Math.max(0, Math.min(7, Math.round(z)))}`];

export function ZoneChip({ zone, size = 'md', label }: { zone: ZoneLevel; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return <span className={cx(s.chip, zoneClass(zone), size === 'lg' && s.chipLg, size === 'sm' && s.chipSm)} title={label}>{zone ? `Z${zone}` : '—'}</span>;
}

export interface ZoneSegment { zone: ZoneLevel; seconds: number; label?: string }

/** Bande horizontale : largeur = durée, couleur = zone. `labels` écrit la durée sous chaque segment assez large. */
export function ZoneStrip({ segments, height = 14, labels, title }: { segments: ZoneSegment[]; height?: number; labels?: boolean; title: string }) {
  const total = segments.reduce((n, x) => n + x.seconds, 0) || 1;
  return (
    <div className={s.strip} role="img" aria-label={title}>
      <div className={s.stripBar} style={{ ['--h' as string]: `${height}px` }}>
        {segments.map((x, i) => <span key={i} className={zoneClass(x.zone)} style={{ flexGrow: x.seconds, flexBasis: 0 }} />)}
      </div>
      {labels ? (
        <div className={s.stripLabels} aria-hidden="true">
          {segments.map((x, i) => <span key={i} style={{ flexGrow: x.seconds, flexBasis: 0 }}>{x.seconds / total > 0.12 ? x.label ?? '' : ''}</span>)}
        </div>
      ) : null}
    </div>
  );
}

/** Profil de séance : une barre par étape, largeur = durée, hauteur et couleur = zone. */
export function ZoneProfile({ bars, height = 64, title }: { bars: { zone: ZoneLevel; seconds: number }[]; height?: number; title: string }) {
  return (
    <div className={s.profile} style={{ ['--h' as string]: `${height}px` }} role="img" aria-label={title}>
      {bars.map((b, i) => (
        <span key={i} className={zoneClass(b.zone)} style={{ flexGrow: b.seconds, flexBasis: 0, height: `${b.zone ? 18 + (b.zone - 1) * (82 / 6) : 14}%` }} />
      ))}
    </div>
  );
}
