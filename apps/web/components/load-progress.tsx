import { formatLongDate, progressText, setText, type LoadSeries } from '@coachos/domain';

/**
 * D-096 (M4) · Progression des charges, exercice par exercice : meilleure série de la dernière séance, évolution
 * depuis la première, nombre de séances. Texte seul (lisible sans couleur ni graphique).
 */
export function LoadProgress({ series, you = false, limit = 8 }: { series: LoadSeries[]; you?: boolean; limit?: number }) {
  if (!series.length) return null;
  return (
    <ul className="plain lp-list">
      {series.slice(0, limit).map((s) => {
        const last = s.points.at(-1)!;
        const evo = progressText(s);
        return (
          <li key={s.key} className="lp">
            <span className="lp-head"><strong>{s.name}</strong> <span className="muted">· {s.points.length} séance{s.points.length > 1 ? 's' : ''}</span></span>
            <span>Meilleure série {you ? 'la dernière fois' : 'récente'} : <strong>{setText({ reps: last.topReps, kg: last.topKg, seconds: last.topSeconds })}</strong>
              <span className="muted"> ({formatLongDate(last.date).toLowerCase()})</span></span>
            {evo ? <span className="lp-evo">Évolution : {evo}</span> : null}
          </li>
        );
      })}
      {series.length > limit ? <li className="muted">Et {series.length - limit} autre{series.length - limit > 1 ? 's' : ''} exercice{series.length - limit > 1 ? 's' : ''}.</li> : null}
    </ul>
  );
}
