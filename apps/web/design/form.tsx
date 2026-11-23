'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './cx';
import s from './form.module.css';

/** Champ avec libellé, aide et erreur reliés au contrôle (aria-describedby). */
export function Field({ label, hint, error, children, id }: { label: ReactNode; hint?: ReactNode; error?: string | null; id: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className={s.hint} id={`${id}-hint`}>{hint}</span> : null}
      {error ? <span className={s.error} id={`${id}-error`} role="alert">{error}</span> : null}
    </div>
  );
}

const described = (id: string | undefined, hint?: boolean, error?: boolean) =>
  [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

export function Input({ invalid, hasHint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; hasHint?: boolean }) {
  return <input className={cx(s.control, className)} aria-invalid={invalid || undefined} aria-describedby={described(rest.id, hasHint, invalid)} {...rest} />;
}

export function Textarea({ invalid, hasHint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; hasHint?: boolean }) {
  return <textarea className={cx(s.control, className)} aria-invalid={invalid || undefined} aria-describedby={described(rest.id, hasHint, invalid)} {...rest} />;
}

export function Select({ invalid, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return <select className={cx(s.control, className)} aria-invalid={invalid || undefined} {...rest}>{children}</select>;
}

export interface ChoiceOption<V extends string> { value: V; label: string; icon?: IconName; hint?: string }

function Legend({ children, hint, hidden }: { children: ReactNode; hint?: ReactNode; hidden?: boolean }) {
  return (
    <legend className={cx(s.legend, hidden && 'ds-visually-hidden')}>
      {children}{hint ? <span className={s.legendHint}>{hint}</span> : null}
    </legend>
  );
}

/**
 * Choix unique en gros boutons : vrais boutons radio (flèches du clavier, lecteurs d’écran).
 * `idPrefix` donne à chaque bouton l’identifiant `${idPrefix}-${valeur}` (lien depuis un résumé d’erreurs).
 */
export function ChoiceGroup<V extends string>({ legend, hint, name, options, value, onChange, disabled, hideLegend, columns, idPrefix, describedBy }:
  { legend: ReactNode; hint?: ReactNode; name: string; options: ChoiceOption<V>[]; value: V | null; onChange: (v: V) => void; disabled?: boolean; hideLegend?: boolean; columns?: number; idPrefix?: string; describedBy?: string }) {
  const uid = useId();
  return (
    <fieldset className={s.choices} style={{ ['--n' as string]: columns ?? options.length }} disabled={disabled} aria-describedby={describedBy}>
      <Legend hint={hint} hidden={hideLegend}>{legend}</Legend>
      {options.map((o) => (
        <label key={o.value} className={s.choice}>
          <input type="radio" id={idPrefix ? `${idPrefix}-${o.value}` : undefined} name={`${name}-${uid}`} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className={s.choiceFace}>{o.icon ? <Icon name={o.icon} size={22} /> : null}{o.label}{o.hint ? <span className={s.hint}>{o.hint}</span> : null}</span>
        </label>
      ))}
    </fieldset>
  );
}

export interface ChipOption<V extends string | number> { value: V; label: string }

/** Pastilles : une seule réponse ; effaçable quand la réponse est facultative (`clearable`, par défaut). */
export function ChipChoice<V extends string | number>({ legend, hint, name, options, value, onChange, clearLabel = 'Effacer', clearable = true, idPrefix, children }:
  { legend: ReactNode; hint?: ReactNode; name: string; options: ChipOption<V>[]; value: V | null; onChange: (v: V | null) => void; clearLabel?: string; clearable?: boolean; idPrefix?: string; children?: ReactNode }) {
  const uid = useId();
  return (
    <fieldset className={s.chipSet}>
      <Legend hint={hint}>{legend}</Legend>
      <div className={s.chips}>
        {options.map((o) => (
          <label key={String(o.value)} className={s.chip}>
            <input type="radio" id={idPrefix ? `${idPrefix}-${o.value}` : undefined} name={`${name}-${uid}`} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className={s.chipFace}>{o.label}</span>
          </label>
        ))}
        {clearable && value !== null ? <button type="button" className={s.clear} onClick={() => onChange(null)}>{clearLabel}</button> : null}
      </div>
      {children}
    </fieldset>
  );
}

/** Pastilles : plusieurs réponses possibles (cases à cocher). */
export function ChipChecks<V extends string | number>({ legend, hint, options, value, onChange, hideLegend }:
  { legend: ReactNode; hint?: ReactNode; options: ChipOption<V>[]; value: V[]; onChange: (v: V[]) => void; hideLegend?: boolean }) {
  return (
    <fieldset className={s.chipSet}>
      <Legend hint={hint} hidden={hideLegend}>{legend}</Legend>
      <div className={s.chips}>
        {options.map((o) => (
          <label key={String(o.value)} className={s.chip}>
            <input type="checkbox" checked={value.includes(o.value)} onChange={() => onChange(value.includes(o.value) ? value.filter((x) => x !== o.value) : [...value, o.value])} />
            <span className={s.chipFace}><span className={s.chipTick} aria-hidden="true"><Icon name="check" size={14} /></span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Échelle numérotée (effort de 0 à 10) : une rangée de boutons radio, les deux bouts nommés.
 * Réponse facultative : rien n’est coché d’office, « Effacer » revient à « non noté ». `idPrefix` nomme chaque marche.
 */
export function ScaleChoice({ legend, hint, name, min, max, value, onChange, lowLabel, highLabel, idPrefix, clearLabel = 'Effacer' }:
  { legend: ReactNode; hint?: ReactNode; name: string; min: number; max: number; value: number | null; onChange: (v: number | null) => void; lowLabel: string; highLabel: string; idPrefix?: string; clearLabel?: string }) {
  const uid = useId();
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <fieldset className={s.chipSet}>
      <Legend hint={hint}>{legend}</Legend>
      <div className={s.scale} style={{ ['--n' as string]: steps.length }}>
        {steps.map((v) => (
          <label key={v} className={s.scaleStep}>
            <input type="radio" id={idPrefix ? `${idPrefix}-${v}` : undefined} name={`${name}-${uid}`} checked={value === v} onChange={() => onChange(v)}
              aria-label={v === min ? `${v}, ${lowLabel}` : v === max ? `${v}, ${highLabel}` : String(v)} />
            <span className={s.scaleFace} aria-hidden="true">{v}</span>
          </label>
        ))}
      </div>
      <div className={s.scaleEnds}>
        <span aria-hidden="true">{lowLabel}</span>
        {value !== null ? <button type="button" className={s.clear} onClick={() => onChange(null)}>{clearLabel}</button> : null}
        <span aria-hidden="true">{highLabel}</span>
      </div>
    </fieldset>
  );
}
