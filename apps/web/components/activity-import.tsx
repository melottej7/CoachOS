'use client';

import { useRef, useState } from 'react';
import {
  ACTIVITY_FORMAT_LABELS, activityFingerprint, formatLongDate, readActivityFile, SPORT_LABELS, utcToLocal,
  type FeedbackActivity, type Sport,
} from '@coachos/domain';

// CE-X-02 (D-048) et CE-X-03 (D-064) : l’élève choisit un ou plusieurs fichiers exportés de sa montre ; ils sont lus ici,
// dans son navigateur. Seuls sport, début, durée et distance sont repris ; le fichier lui-même n’est jamais envoyé.

const describe = (a: FeedbackActivity, timeZone: string) => {
  const local = a.startedAt ? utcToLocal(new Date(a.startedAt), timeZone) : null;
  return [
    a.sport ? SPORT_LABELS[a.sport] : null,
    a.seconds ? `${Math.round(a.seconds / 60)} min` : null,
    a.distanceM ? `${(a.distanceM / 1000).toFixed(2).replace('.', ',')} km` : null,
    local ? `${formatLongDate(local.date).toLowerCase()} à ${local.time}` : null,
  ].filter(Boolean).join(' · ');
};

export function ActivityImport({ plannedDate, plannedSport, timeZone, items, onChange }: {
  plannedDate: string; plannedSport: Sport; timeZone: string;
  items: FeedbackActivity[];
  onChange: (next: FeedbackActivity[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const errs: string[] = [];
    const next = [...items];
    for (const file of Array.from(files)) {
      try {
        const r = readActivityFile(file.name, new Uint8Array(await file.arrayBuffer()));
        if (!r.ok) { errs.push(`${file.name} : ${r.error}`); continue; }
        const a: FeedbackActivity = { format: r.summary.format, sport: r.summary.sport, startedAt: r.summary.startedAt, seconds: r.summary.seconds, distanceM: r.summary.distanceM };
        if (!a.seconds && !a.distanceM) { errs.push(`${file.name} : aucune durée ni distance dans ce fichier.`); continue; }
        if (next.some((x) => activityFingerprint(x) === activityFingerprint(a))) { errs.push(`${file.name} : cette activité est déjà ajoutée.`); continue; }
        if (next.length >= 10) { errs.push('10 activités au plus par séance.'); break; }
        next.push(a);
      } catch {
        errs.push(`${file.name} : ce fichier n’a pas pu être lu. Réessaie avec un fichier .fit, .tcx ou .gpx.`);
      }
    }
    next.sort((x, y) => (x.startedAt ?? '').localeCompare(y.startedAt ?? ''));
    setErrors(errs);
    setBusy(false);
    if (input.current) input.current.value = '';
    if (next.length !== items.length) onChange(next);
  }

  return (
    <div className="ai">
      <input ref={input} id="activity-file" type="file" multiple accept=".fit,.tcx,.gpx,application/vnd.ant.fit,application/gpx+xml,application/vnd.garmin.tcx+xml"
        className="visually-hidden" onChange={(e) => void pick(e.target.files)} />
      <label htmlFor="activity-file" className="btn" aria-busy={busy}>⌚ {busy ? 'Lecture…' : items.length ? 'Ajouter une autre activité' : 'Importer depuis ma montre'}</label>
      <span className="hint">Fichier .fit, .tcx ou .gpx, un ou plusieurs (échauffement et course enregistrés à part, montre coupée…). Ils restent sur ton appareil : seuls le sport, l’heure, la durée et la distance sont repris.</span>
      {errors.length ? <div className="field-error" role="alert">{errors.map((e, i) => <p key={i}>{e}</p>)}</div> : null}
      {items.length ? (
        <div className="ai-done" role="status">
          <p><strong>{items.length > 1 ? `${items.length} activités rattachées à cette séance` : 'Activité rattachée à cette séance'}</strong>
            {items.length > 1 ? ' : durée et distance additionnées ci-dessous' : ' : durée et distance remplies ci-dessous'}, tu peux les corriger.</p>
          <ul className="plain ai-list">
            {items.map((a) => {
              const local = a.startedAt ? utcToLocal(new Date(a.startedAt), timeZone) : null;
              const otherDay = local && local.date !== plannedDate;
              const otherSport = a.sport && a.sport !== plannedSport && !(plannedSport === 'trail' && a.sport === 'running');
              return (
                <li key={activityFingerprint(a)}>
                  <span>{ACTIVITY_FORMAT_LABELS[a.format]} · {describe(a, timeZone)}</span>
                  <button type="button" className="link-btn" onClick={() => onChange(items.filter((x) => x !== a))} aria-label={`Retirer l’activité ${describe(a, timeZone)}`}>Retirer</button>
                  {otherDay ? <p className="ai-warn">Activité du {formatLongDate(local!.date).toLowerCase()}, séance prévue le {formatLongDate(plannedDate).toLowerCase()}. Vérifie que c’est la bonne.</p> : null}
                  {otherSport ? <p className="ai-warn">Sport différent du prévu ({SPORT_LABELS[a.sport!]}) : précise-le dans « Ma séance était différente du prévu ».</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
