'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';

interface Props {
  initialName: string;
  initialLocale: Locale;
  /** Fuseau de la relation athlète (X07). Absent pour un coach. */
  athlete?: { wid: string; timeZone: string; zones: string[] };
  submitLabel: string;
  after: string;
}

/** X07 / X45 : nom, langue et, pour un athlète, fuseau de la relation. Aucune donnée de santé. */
export function ProfileForm({ initialName, initialLocale, athlete, submitLabel, after }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [timeZone, setTimeZone] = useState(athlete?.timeZone ?? '');
  const me = useIntent<{ displayName: string }>();
  const tz = useIntent<{ timeZone: string }>();
  const pending = me.pending || tz.pending;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (name.trim() !== initialName || locale !== initialLocale) {
      if (!(await me.run('PATCH', '/api/v1/me', { displayName: name, locale }))) return;
    }
    if (athlete && timeZone !== athlete.timeZone) {
      if (!(await tz.run('PATCH', `/api/v1/workspaces/${athlete.wid}/athlete-settings`, { timeZone }))) return;
    }
    router.push(after);
    router.refresh();
  }

  const error = me.error ?? tz.error;
  return (
    <form className="form" onSubmit={submit} noValidate>
      <ErrorSummary error={error} onRetry={() => void submit()} />
      <div className="field">
        <label htmlFor="displayName">Ton nom <span className="hint">{athlete ? 'Nom de ton compte. Ton coach garde le nom de ton dossier.' : 'Nom de ton compte, affiché en haut de l’écran.'}</span></label>
        <input id="displayName" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
          aria-invalid={!!fieldError(error, 'displayName')} />
        {fieldError(error, 'displayName') ? <span className="field-error">{fieldError(error, 'displayName')}</span> : null}
      </div>
      <div className="field">
        <label htmlFor="locale">Langue</label>
        <select id="locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
        </select>
      </div>
      {athlete ? (
        <div className="field">
          <label htmlFor="timeZone">Fuseau horaire <span className="hint">Tes séances s’affichent selon ce fuseau. Les séances déjà prévues gardent leur date.</span></label>
          <select id="timeZone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
            {athlete.zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
          </select>
          {fieldError(error, 'timeZone') ? <span className="field-error">{fieldError(error, 'timeZone')}</span> : null}
        </div>
      ) : null}
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : submitLabel}</button>
      </div>
    </form>
  );
}
