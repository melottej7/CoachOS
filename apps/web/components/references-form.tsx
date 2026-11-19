'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPace, parseSwimPace, ZONE_NAMES, zonePace, zonePower, zoneSwimPace, ZONES } from '@coachos/domain';
import { useIntent } from './use-intent';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Repères d’entraînement fixés par le coach (CE-B-03, D-029, D-055) : VMA (course), FTP (vélo), CSS (natation).
 * Chacun traduit les 7 zones pour cet élève : allures, watts, allures de nage ; il sert aussi aux estimations et au fichier FIT.
 */
export function ReferencesForm({ wid, aid, first, vmaKmh, ftpW, cssSecPer100 }: {
  wid: string; aid: string; first: string; vmaKmh: number | null; ftpW?: number | null; cssSecPer100?: number | null;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  const [vmaText, setVma] = useState(vmaKmh === null ? '' : String(vmaKmh).replace('.', ','));
  const [ftpText, setFtp] = useState(ftpW ? String(ftpW) : '');
  const [cssText, setCss] = useState(cssSecPer100 ? mmss(cssSecPer100) : '');
  const [saved, setSaved] = useState(false);

  const vma = vmaText.trim() === '' ? null : Number(vmaText.replace(',', '.'));
  const ftp = ftpText.trim() === '' ? null : Number(ftpText);
  const css = cssText.trim() === '' ? null : parseSwimPace(cssText);
  const errs = {
    vma: vma !== null && !(Number.isFinite(vma) && vma >= 6 && vma <= 30) ? 'VMA : un nombre entre 6 et 30 km/h' : null,
    ftp: ftp !== null && !(Number.isInteger(ftp) && ftp >= 50 && ftp <= 600) ? 'FTP : un nombre entier entre 50 et 600 W' : null,
    css: cssText.trim() !== '' && (css === null || css < 50 || css > 300) ? 'CSS : une allure pour 100 m, par exemple 1:45' : null,
  };
  const valid = !errs.vma && !errs.ftp && !errs.css;
  const serverError = error?.kind === 'error' ? error.fields[0]?.rule ?? error.message : error ? 'Connexion perdue. Réessaie.' : null;
  const touch = () => setSaved(false);
  const showVma = vma !== null && !errs.vma, showFtp = ftp !== null && !errs.ftp, showCss = css !== null && !errs.css;

  return (
    <form className="stack" noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaved(false);
        const r = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/references`, { vmaKmh: vma, ftpW: ftp, cssSecPer100: css });
        if (r) { setSaved(true); router.refresh(); }
      }}>
      <p className="muted">Les repères de {first} traduisent les zones en allures ou en watts, dans ses séances et dans le fichier pour sa montre. Remplis ceux de ses sports.</p>
      <div className="refs-grid">
        <div className="field">
          <label htmlFor="vma">VMA <span className="hint">Course · km/h</span></label>
          <span className="b-inline"><input id="vma" className="num" inputMode="decimal" placeholder="15,5" value={vmaText} aria-invalid={!!errs.vma}
            aria-describedby={errs.vma ? 'vma-error' : undefined} onChange={(e) => { setVma(e.target.value); touch(); }} /> km/h</span>
          {errs.vma ? <p className="field-error" id="vma-error">{errs.vma}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="ftp">FTP <span className="hint">Vélo · watts sur 1 h</span></label>
          <span className="b-inline"><input id="ftp" className="num" inputMode="numeric" placeholder="230" value={ftpText} aria-invalid={!!errs.ftp}
            aria-describedby={errs.ftp ? 'ftp-error' : undefined} onChange={(e) => { setFtp(e.target.value); touch(); }} /> W</span>
          {errs.ftp ? <p className="field-error" id="ftp-error">{errs.ftp}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="css">CSS <span className="hint">Natation · allure seuil</span></label>
          <span className="b-inline"><input id="css" className="num" inputMode="text" placeholder="1:45" value={cssText} aria-invalid={!!errs.css}
            aria-describedby={errs.css ? 'css-error' : undefined} onChange={(e) => { setCss(e.target.value); touch(); }} /> /100 m</span>
          {errs.css ? <p className="field-error" id="css-error">{errs.css}</p> : null}
        </div>
      </div>
      <span className="b-inline">
        <button className="btn primary small" type="submit" disabled={pending || !valid}>{pending ? 'Enregistrement…' : 'Enregistrer les repères'}</button>
        {saved ? <span className="muted" role="status">Enregistré.</span> : null}
      </span>
      {serverError ? <p className="field-error" role="alert">{serverError}</p> : null}
      {showVma || showFtp || showCss ? (
        <div className="table-scroll">
          <table className="zones-table">
            <caption className="visually-hidden">Cibles par zone pour {first}</caption>
            <thead><tr><th scope="col">Zone</th><th scope="col">Usage</th>
              {showVma ? <th scope="col">Course</th> : null}{showFtp ? <th scope="col">Vélo</th> : null}{showCss ? <th scope="col">Natation</th> : null}</tr></thead>
            <tbody>
              {ZONES.map((z) => {
                const p = showVma ? zonePace(z, vma!) : null;
                const w = showFtp ? zonePower(z, ftp!) : null;
                const s = showCss ? zoneSwimPace(z, css!) : null;
                return (
                  <tr key={z}>
                    <th scope="row"><span className={`zone-dot z${z}`} aria-hidden="true" />Z{z}</th>
                    <td>{ZONE_NAMES[z]}</td>
                    {p ? <td>{formatPace(p[0]).replace(' /km', '')} à {formatPace(p[1])}</td> : null}
                    {w ? <td>{w[0]} à {w[1]} W</td> : null}
                    {s ? <td>{mmss(s[0])} à {mmss(s[1])} /100 m</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="muted">Sans repère, les séances indiquent les zones et la durée, sans allure, watts ni kilomètres estimés.</p>}
    </form>
  );
}
