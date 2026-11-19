'use client';

import { useRef, useState } from 'react';
import {
  ACTIVITY_FORMAT_LABELS, formatLongDate, readActivityFile, SPORT_LABELS, utcToLocal,
  type ActivityFormat, type ActivitySummary, type Sport,
} from '@coachos/domain';

// CE-X-02 (D-048) : l’élève choisit le fichier exporté de sa montre ; il est lu ici, dans son navigateur.
// Seules la durée et la distance préremplissent le retour, qu’il peut corriger ; rien d’autre n’est lu ni envoyé.

export function ActivityImport({ plannedDate, plannedSport, timeZone, onRead }: {
  plannedDate: string; plannedSport: Sport; timeZone: string;
  onRead: (s: ActivitySummary) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const r = readActivityFile(file.name, new Uint8Array(await file.arrayBuffer()));
      if (!r.ok) { setError(r.error); setSummary(null); return; }
      setSummary(r.summary);
      onRead(r.summary);
    } catch {
      setError('Ce fichier n’a pas pu être lu. Réessaie avec un fichier .fit, .tcx ou .gpx.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const local = summary?.startedAt ? utcToLocal(new Date(summary.startedAt), timeZone) : null;
  const otherDay = local && local.date !== plannedDate;
  const otherSport = summary?.sport && summary.sport !== plannedSport && !(plannedSport === 'trail' && summary.sport === 'running');
  const parts = summary ? [
    summary.sport ? SPORT_LABELS[summary.sport] : null,
    summary.seconds ? `${Math.round(summary.seconds / 60)} min` : null,
    summary.distanceM ? `${(summary.distanceM / 1000).toFixed(2).replace('.', ',')} km` : null,
    local ? `${formatLongDate(local.date).toLowerCase()} à ${local.time}` : null,
  ].filter(Boolean) : [];

  return (
    <div className="ai">
      <input ref={input} id="activity-file" type="file" accept=".fit,.tcx,.gpx,application/vnd.ant.fit,application/gpx+xml,application/vnd.garmin.tcx+xml"
        className="visually-hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      <label htmlFor="activity-file" className="btn" aria-busy={busy}>⌚ {busy ? 'Lecture…' : summary ? 'Choisir un autre fichier' : 'Importer depuis ma montre'}</label>
      <span className="hint">Fichier .fit, .tcx ou .gpx. Il reste sur ton appareil : seules la durée et la distance sont reprises.</span>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {summary ? (
        <div className="ai-done" role="status">
          <p><strong>Lu dans ton fichier {ACTIVITY_FORMAT_LABELS[summary.format as ActivityFormat]}</strong> : {parts.join(' · ')}. Durée et distance sont remplies ci-dessous, tu peux les corriger.</p>
          {otherDay ? <p className="ai-warn">Cette activité date du {formatLongDate(local!.date).toLowerCase()}, la séance était prévue le {formatLongDate(plannedDate).toLowerCase()}. Vérifie que c’est la bonne.</p> : null}
          {otherSport ? <p className="ai-warn">Sport différent du prévu ({SPORT_LABELS[summary.sport!]}) : précise-le dans « Ma séance était différente du prévu ».</p> : null}
        </div>
      ) : null}
    </div>
  );
}
