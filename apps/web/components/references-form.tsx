'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPace, ZONE_NAMES, zonePace, ZONES } from '@coachos/domain';
import { useIntent } from './use-intent';

/** Repères d’entraînement fixés par le coach (CE-B-03, D-029) : VMA et allures des 7 zones qui en découlent. */
export function ReferencesForm({ wid, aid, first, vmaKmh }: { wid: string; aid: string; first: string; vmaKmh: number | null }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ item: { vmaKmh: number | null } }>();
  const [text, setText] = useState(vmaKmh === null ? '' : String(vmaKmh).replace('.', ','));
  const [saved, setSaved] = useState(false);
  const value = text.trim() === '' ? null : Number(text.replace(',', '.'));
  const valid = value === null || (Number.isFinite(value) && value >= 6 && value <= 30);
  const fieldError = !valid ? 'VMA : un nombre entre 6 et 30 km/h' : error?.kind === 'error' ? error.fields[0]?.rule ?? error.message : error ? 'Connexion perdue. Réessaie.' : null;

  return (
    <form className="stack" noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaved(false);
        const r = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/references`, { vmaKmh: value });
        if (r) { setSaved(true); router.refresh(); }
      }}>
      <div className="field">
        <label htmlFor="vma">VMA de {first} <span className="hint">km/h · sert à traduire les zones en allures et à estimer les kilomètres</span></label>
        <span className="b-inline">
          <input id="vma" className="num" inputMode="decimal" placeholder="15,5" value={text} aria-invalid={!valid}
            aria-describedby={fieldError ? 'vma-error' : undefined}
            onChange={(e) => { setText(e.target.value); setSaved(false); }} /> km/h
          <button className="btn primary small" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
          {saved ? <span className="muted" role="status">Enregistré.</span> : null}
        </span>
        {fieldError ? <p className="field-error" id="vma-error">{fieldError}</p> : null}
      </div>
      {value !== null && valid ? (
        <table className="zones-table">
          <caption className="visually-hidden">Allures cibles par zone pour une VMA de {value} km/h</caption>
          <thead><tr><th scope="col">Zone</th><th scope="col">Usage</th><th scope="col">Allure cible</th></tr></thead>
          <tbody>
            {ZONES.map((z) => {
              const [slow, fast] = zonePace(z, value);
              return (
                <tr key={z}>
                  <th scope="row"><span className={`zone-dot z${z}`} aria-hidden="true" />Z{z}</th>
                  <td>{ZONE_NAMES[z]}</td>
                  <td>{formatPace(slow).replace(' /km', '')} à {formatPace(fast)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : <p className="muted">Sans VMA, les séances indiquent les zones et la durée, sans allure ni kilomètres estimés.</p>}
    </form>
  );
}
