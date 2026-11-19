'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  equivalents, formatDuration2, formatPace, parseDuration, PERFORMANCE_KIND_LABELS, PERFORMANCE_KINDS, SPORT_LABELS, SPORTS, vmaFromTest,
  type Performance, type PerformanceKind, type Sport,
} from '@coachos/domain';
import { useIntent } from './use-intent';

// D-060 : résultats de référence de l’élève. Allure, équivalences (course), VMA d’un test de 6 minutes.

const fmtDay = (d: string) => new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const fmtDist = (m: number) => (m < 1000 ? `${m} m` : `${String(Math.round(m / 100) / 10).replace('.', ',')} km`);

/** « 10 », « 21,1 », « 21.1 km », « 400 m », « 1500m » → mètres. */
function parseDistance(t: string): number | null {
  const s = t.trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(km|m)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(m[2] === 'm' ? n : n * 1000);
}

export function PerformancesPanel({ wid, aid, first, sport, items, today, vmaKmh }: {
  wid: string; aid: string; first: string; sport: Sport | null; items: Performance[]; today: string; vmaKmh: number | null;
}) {
  const router = useRouter();
  const add = useIntent<unknown>();
  const del = useIntent<unknown>();
  const useVma = useIntent<unknown>();
  const [kind, setKind] = useState<PerformanceKind>('race');
  const [sp, setSp] = useState<Sport>(sport ?? 'running');
  const [name, setName] = useState('');
  const [dist, setDist] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const distM = parseDistance(dist);
  const timeS = parseDuration(time);
  const ok = distM !== null && distM >= 50 && timeS !== null && Boolean(date) && date <= today;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const r = await add.run('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/performances`, { sport: sp, kind, name: name || null, distanceM: distM, durationS: timeS, doneOn: date });
    if (r) { setName(''); setDist(''); setTime(''); setDate(''); router.refresh(); }
  }

  return (
    <div className="stack">
      <p className="muted">Courses, tests et séances de référence de {first}. Ils servent à juger un chrono visé (faisabilité) et à connaître son passif.</p>
      {items.length ? (
        <ul className="plain perf-list">
          {items.map((p) => {
            const eq = equivalents(p);
            const vma = vmaFromTest(p);
            return (
              <li key={p.id} className="perf">
                <span className="perf-head">
                  <strong>{p.name ?? PERFORMANCE_KIND_LABELS[p.kind]}</strong>
                  <span className="muted"> · {PERFORMANCE_KIND_LABELS[p.kind]} · {SPORT_LABELS[p.sport]} · {fmtDay(p.doneOn)}</span>
                </span>
                <span>{fmtDist(p.distanceM)} en <strong>{formatDuration2(p.durationS)}</strong>
                  {p.sport === 'running' || p.sport === 'trail' ? ` · ${formatPace(Math.round(p.durationS / (p.distanceM / 1000)))}` : ''}</span>
                {eq.length ? <span className="muted perf-eq">Équivalences : {eq.map((e) => `${e.label} ${formatDuration2(e.seconds)}`).join(' · ')}</span> : null}
                {vma ? (
                  <span className="perf-vma">VMA estimée : <strong>{String(vma).replace('.', ',')} km/h</strong>
                    {vmaKmh !== vma ? <> · <button type="button" className="link-btn" disabled={useVma.pending}
                      onClick={async () => { if (await useVma.run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/references`, { vmaKmh: vma })) router.refresh(); }}>
                      Utiliser comme VMA</button></> : ' (VMA actuelle)'}</span>
                ) : null}
                <button type="button" className="link-btn perf-del" disabled={del.pending}
                  onClick={async () => { if (window.confirm('Retirer ce résultat ?') && await del.run('DELETE', `/api/v1/workspaces/${wid}/athletes/${aid}/performances/${p.id}`, {})) router.refresh(); }}>Retirer</button>
              </li>
            );
          })}
        </ul>
      ) : <p className="empty">Aucun résultat pour l’instant.</p>}
      <details className="perf-add">
        <summary>+ Ajouter un résultat</summary>
        <form className="stack" onSubmit={submit} noValidate>
          <div className="form-row">
            <label className="field"><span>Type</span>
              <select aria-label="Type de résultat" value={kind} onChange={(e) => setKind(e.target.value as PerformanceKind)}>{PERFORMANCE_KINDS.map((k) => <option key={k} value={k}>{PERFORMANCE_KIND_LABELS[k]}</option>)}</select></label>
            <label className="field"><span>Sport</span>
              <select aria-label="Sport" value={sp} onChange={(e) => setSp(e.target.value as Sport)}>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}</select></label>
          </div>
          <label className="field"><span>Nom <span className="hint">Facultatif · ex. « 10 km de Bruxelles », « Test 6 minutes »</span></span>
            <input aria-label="Nom du résultat" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="form-row">
            <label className="field"><span>Distance</span>
              <input aria-label="Distance" value={dist} placeholder="10 ou 1500 m" aria-invalid={dist !== '' && distM === null} onChange={(e) => setDist(e.target.value)} /></label>
            <label className="field"><span>Temps</span>
              <input aria-label="Temps" value={time} placeholder="45:30 ou 1h45" aria-invalid={time !== '' && timeS === null} onChange={(e) => setTime(e.target.value)} /></label>
            <label className="field"><span>Date</span>
              <input aria-label="Date du résultat" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
          {add.error ? <p className="field-error" role="alert">{add.error.kind === 'error' ? (add.error.fields[0]?.rule ?? add.error.message) : 'Connexion perdue. Réessaie.'}</p> : null}
          <div className="actions"><button className="btn primary small" type="submit" disabled={!ok || add.pending}>{add.pending ? 'Ajout…' : 'Ajouter le résultat'}</button></div>
        </form>
      </details>
    </div>
  );
}
