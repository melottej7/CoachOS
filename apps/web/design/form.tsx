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

/** Choix unique en gros boutons : vrais boutons radio (flèches du clavier, lecteurs d’écran). */
export function ChoiceGroup<V extends string>({ legend, name, options, value, onChange, disabled, hideLegend }:
  { legend: string; name: string; options: ChoiceOption<V>[]; value: V | null; onChange: (v: V) => void; disabled?: boolean; hideLegend?: boolean }) {
  const uid = useId();
  return (
    <fieldset className={s.choices} style={{ ['--n' as string]: options.length }} disabled={disabled}>
      <legend className={hideLegend ? 'ds-visually-hidden' : undefined}>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={s.choice}>
          <input type="radio" name={`${name}-${uid}`} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className={s.choiceFace}>{o.icon ? <Icon name={o.icon} size={22} /> : null}{o.label}{o.hint ? <span className={s.hint}>{o.hint}</span> : null}</span>
        </label>
      ))}
    </fieldset>
  );
}
