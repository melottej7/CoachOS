import { formatLongDate, progressText, setText, type LoadSeries } from '@coachos/domain';
import { Text } from '@/design';
import s from './load-progress.module.css';

/**
 * D-096 (M4), refonte D-134 · Progression des charges, exercice par exercice : meilleure série de la dernière séance,
 * évolution depuis la première, nombre de séances. Texte seul : lisible sans couleur ni graphique.
 */
export function LoadProgress({ series, you = false, limit = 8 }: { series: LoadSeries[]; you?: boolean; limit?: number }) {
  if (!series.length) return null;
  return (
    <ul className={s.list}>
      {series.slice(0, limit).map((x) => {
        const last = x.points.at(-1)!;
        const evo = progressText(x);
        return (
          <li key={x.key} className={s.row}>
            <span className={s.text}>
              <span className={s.name}>{x.name}</span>
              <Text as="span" size="sm" muted>{x.points.length} séance{x.points.length > 1 ? 's' : ''} · {you ? 'la dernière' : 'dernière'} le {formatLongDate(last.date).toLowerCase()}</Text>
              {evo ? <Text as="span" size="sm">Évolution : <strong>{evo}</strong></Text> : null}
            </span>
            <span className={s.best}>
              <span className={s.bestValue}>{setText({ reps: last.topReps, kg: last.topKg, seconds: last.topSeconds })}</span>
              <span className={s.bestLabel}>meilleure série</span>
            </span>
          </li>
        );
      })}
      {series.length > limit ? <li className={s.more}>Et {series.length - limit} autre{series.length - limit > 1 ? 's' : ''} exercice{series.length - limit > 1 ? 's' : ''}.</li> : null}
    </ul>
  );
}
