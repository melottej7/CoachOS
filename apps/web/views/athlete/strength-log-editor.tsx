'use client';

import { setText, type PlannedEntry, type StrengthEntry, type StrengthSet } from '@coachos/domain';
import { Button, Cluster, Text } from '@/design';
import s from './strength-log-editor.module.css';

/** « 4 séries de 10 × 16 kg » plutôt que la même série répétée quatre fois. */
function plannedText(sets: StrengthSet[]): string {
  const texts = sets.map(setText);
  return texts.every((x) => x === texts[0]) ? `${texts.length} série${texts.length > 1 ? 's' : ''} de ${texts[0]}` : texts.join(' · ');
}

/**
 * D-096 (M4) · Séries et charges réalisées, exercice par exercice. Prérempli avec le prévu (ou ce qui a été noté
 * pendant « Suivre ») : l’élève ne touche qu’aux séries qui ont changé.
 */
export function StrengthLogEditor({ plan, value, onChange, onReset }: {
  plan: PlannedEntry[]; value: StrengthEntry[]; onChange: (v: StrengthEntry[]) => void; onReset: () => void;
}) {
  const setSet = (ei: number, si: number, patch: Partial<StrengthSet>) =>
    onChange(value.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((x, j) => (j === si ? { ...x, ...patch } : x)) })));
  const num = (t: string, max: number, step = 1) => (t.trim() === '' ? null : Math.max(0, Math.min(max, Math.round(Number(t.replace(',', '.')) / step) * step)));
  return (
    <fieldset className={s.set}>
      <legend className={s.legend}>Séries et charges<span className={s.hint}>Prérempli avec le prévu : corrige seulement ce qui a changé. 0 répétition = série non faite.</span></legend>
      <Cluster><Button size="sm" variant="ghost" icon="copy" onClick={onReset}>Tout remettre comme prévu</Button></Cluster>
      {value.map((e, ei) => {
        const p = plan[ei];
        const withKg = Boolean(p?.sets.some((x) => x.kg !== null) || e.sets.some((x) => x.kg !== null));
        return (
          <div key={`${e.name}-${ei}`} className={s.exercise}>
            <div className={s.head}>
              <Text strong>{e.name}</Text>
              {p ? <Text size="sm" muted>prévu : {plannedText(p.sets)}</Text> : null}
            </div>
            <ol className={s.sets}>
              {e.sets.map((x, si) => (
                <li key={si} className={s.row}>
                  <span className={s.n}>Série {si + 1}</span>
                  {x.seconds !== null && x.reps === null ? (
                    <span>{setText(x)}</span>
                  ) : (
                    <span className={s.inputs}>
                      <label className={s.unit}>
                        <input type="number" inputMode="numeric" min={0} max={500} className={s.num} value={x.reps ?? ''} aria-label={`${e.name}, série ${si + 1} : répétitions`}
                          onChange={(ev) => setSet(ei, si, { reps: num(ev.target.value, 500) })} />
                        <span aria-hidden="true">rép.</span>
                      </label>
                      {withKg ? (
                        <label className={s.unit}>
                          <input type="number" inputMode="decimal" min={0} max={500} step={0.5} className={s.num} value={x.kg ?? ''} aria-label={`${e.name}, série ${si + 1} : charge en kg`}
                            onChange={(ev) => setSet(ei, si, { kg: num(ev.target.value, 500, 0.5) })} />
                          <span aria-hidden="true">kg</span>
                        </label>
                      ) : null}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </fieldset>
  );
}
