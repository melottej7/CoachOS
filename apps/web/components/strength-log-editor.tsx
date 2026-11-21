'use client';

import { setText, type PlannedEntry, type StrengthEntry, type StrengthSet } from '@coachos/domain';

/**
 * D-096 (M4) · Séries et charges réalisées, exercice par exercice. Prérempli avec le prévu (ou ce qui a été noté
 * pendant « Suivre ») : l’élève ne touche qu’aux séries qui ont changé.
 */
export function StrengthLogEditor({ plan, value, onChange, onReset }: {
  plan: PlannedEntry[]; value: StrengthEntry[]; onChange: (v: StrengthEntry[]) => void; onReset: () => void;
}) {
  const setSet = (ei: number, si: number, patch: Partial<StrengthSet>) =>
    onChange(value.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })));
  const num = (t: string, max: number, step = 1) => (t.trim() === '' ? null : Math.max(0, Math.min(max, Math.round(Number(t.replace(',', '.')) / step) * step)));
  return (
    <fieldset className="choice sl">
      <legend>Séries et charges <span className="hint">Corrige seulement ce qui a changé</span></legend>
      <button type="button" className="link-btn" onClick={onReset}>Tout comme prévu</button>
      {value.map((e, ei) => {
        const p = plan[ei];
        const withKg = Boolean(p?.sets.some((s) => s.kg !== null) || e.sets.some((s) => s.kg !== null));
        return (
          <div key={`${e.name}-${ei}`} className="sl-ex">
            <p className="sl-name"><strong>{e.name}</strong> {p ? <span className="muted">· prévu {p.sets.map(setText).join(' · ')}</span> : null}</p>
            <ol className="plain sl-sets">
              {e.sets.map((s, si) => (
                <li key={si} className="sl-set">
                  <span className="muted sl-n">Série {si + 1}</span>
                  {s.seconds !== null && s.reps === null ? (
                    <span>{setText(s)}</span>
                  ) : (
                    <>
                      <label><input type="number" inputMode="numeric" min={0} max={500} className="num" value={s.reps ?? ''} aria-label={`${e.name}, série ${si + 1} : répétitions`}
                        onChange={(x) => setSet(ei, si, { reps: num(x.target.value, 500) })} /> rép</label>
                      {withKg ? (
                        <label><input type="number" inputMode="decimal" min={0} max={500} step={0.5} className="num" value={s.kg ?? ''} aria-label={`${e.name}, série ${si + 1} : charge en kg`}
                          onChange={(x) => setSet(ei, si, { kg: num(x.target.value, 500, 0.5) })} /> kg</label>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
      <p className="muted">0 répétition = série non faite.</p>
    </fieldset>
  );
}
