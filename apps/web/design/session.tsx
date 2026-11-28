import type { ReactNode } from 'react';
import { ZONE_NAMES, type SessionRow, type SessionView, type Zone } from '@coachos/domain';
import { Icon } from './icons';
import { Stats } from './data';
import { ZoneChip, ZoneStrip, type ZoneLevel } from './zones';
import s from './session.module.css';

const z = (n: number) => Math.max(0, Math.min(7, n)) as ZoneLevel;
/** Espace insécable devant les unités : « 1 min 30 s » ne se coupe pas avant le « s ». */
const keep = (t: string) => t.replace(/ (s|min|km|m|kg|W|rép\.?|répétitions?)\b/g, '\u00a0$1');

/** Chiffres clés d’une séance : durée, distance, zone clé. */
export function SessionStats({ view }: { view: SessionView }) {
  if (view.kind === 'strength') {
    return (
      <Stats items={[
        { label: 'Durée', value: view.minutes ?? '—', unit: view.minutes ? ' min' : undefined, sub: view.minutes && view.minutesApprox ? 'environ' : undefined },
        { label: 'Exercices', value: view.exercises || '—' },
        { label: 'Séries', value: view.sets || '—' },
      ]} />
    );
  }
  // Une case vide n’apprend rien : sans distance estimable (vélo sans vitesse connue), on ne la montre pas.
  return (
    <Stats items={[
      // Sans durée calculable (distance sans allure connue), on dit pourquoi au lieu d’un « environ » sans valeur.
      { label: 'Durée', value: view.minutes ?? '—', unit: view.minutes ? ' min' : undefined, sub: view.minutes ? (view.minutesApprox ? 'environ' : undefined) : 'selon l’allure' },
      ...(view.km ? [{ label: 'Distance', value: view.km.replace(/\s?(km|m)$/, ''), unit: ` ${view.km.endsWith('km') ? 'km' : 'm'}`, sub: view.kmApprox ? 'environ' : undefined }] : []),
      // D-202 : de même, sans zone, pas de case « Intensité — libre » ; les consignes du coach disent l’allure.
      ...(view.keyZone ? [{ label: 'Intensité', value: `Z${view.keyZone}`, sub: ZONE_NAMES[view.keyZone as Zone] }] : []),
    ]} />
  );
}

/** Bande des zones de la séance, avec un texte équivalent pour les lecteurs d’écran. */
export function SessionStrip({ view, height = 16 }: { view: SessionView; height?: number }) {
  if (!view.segments.length || view.kind === 'strength') return null;
  const title = `Déroulé : ${view.rows.map((r) => `${r.title}${r.zone ? ` en Z${r.zone}` : ''}`).join(', ')}`;
  const merged: { zone: ZoneLevel; seconds: number }[] = [];
  for (const x of view.segments) {
    const last = merged[merged.length - 1];
    if (last && last.zone === x.zone && view.segments.length > 12) last.seconds += x.seconds;
    else merged.push({ zone: z(x.zone), seconds: x.seconds });
  }
  return <ZoneStrip title={title} height={height} segments={merged.map((m) => ({ ...m, label: m.seconds >= 60 ? `${Math.round(m.seconds / 60)} min` : undefined }))} labels />;
}

/** D-164 : paliers d’un cardio sur machine, avec leur profil (largeur = durée, hauteur = niveau ou vitesse). */
function Stages({ stages, bars }: { stages: string[]; bars: { seconds: number; height: number }[] }) {
  return (
    <span className={s.stages}>
      {bars.length ? (
        <span className={s.stageBars} aria-hidden="true">
          {bars.map((b, i) => <span key={i} style={{ flexGrow: b.seconds, blockSize: `${Math.round(b.height * 100)}%` }} />)}
        </span>
      ) : null}
      <ol className={s.stageList} aria-label="Paliers">
        {stages.map((t, i) => <li key={i}><span className={s.stageNum}>{i + 1}</span>{keep(t)}</li>)}
      </ol>
    </span>
  );
}

/** Une ligne par bloc : zone, ce qu’il faut faire, la cible traduite pour l’élève. */
export function SessionRows({ view, extra }: { view: SessionView; extra?: (row: SessionRow) => ReactNode }) {
  if (!view.rows.length) return null;
  return (
    <ol className={s.rows}>
      {view.rows.map((r, i) => (
        <li key={i} className={r.stages.length ? `${s.row} ${s.rowTall}` : s.row}>
          {r.zone ? <ZoneChip zone={z(r.zone)} size="lg" /> : <span className={s.badge}>{r.badge ?? <Icon name="clock" size={16} />}</span>}
          <span className={s.rowText}>
            <span className={s.rowTitle}>{keep(r.title)}</span>
            {r.detail ? <span className={s.rowDetail}>{keep(r.detail)}</span> : null}
            {r.stages.length ? <Stages stages={r.stages} bars={r.stageBars} /> : null}
          </span>
          {extra?.(r) ? <span className={s.rowExtra}>{extra(r)}</span> : null}
          {r.target ? <span className={s.rowTarget}>{r.target.replace(/ (\/km|\/100 m|W)$/, '')}<small>{/\/100 m$/.test(r.target) ? '/100 m' : /W$/.test(r.target) ? 'watts' : '/km'}</small></span> : null}
        </li>
      ))}
    </ol>
  );
}
