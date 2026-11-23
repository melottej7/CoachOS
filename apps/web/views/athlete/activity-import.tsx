'use client';

import { useRef, useState } from 'react';
import {
  ACTIVITY_FORMAT_LABELS, activityFingerprint, formatLongDate, readActivityFile, SPORT_LABELS, utcToLocal,
  type FeedbackActivity, type Sport,
} from '@coachos/domain';
import { Banner, Button, Cluster, Icon, Stack, Text } from '@/design';
import s from './activity-import.module.css';

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
    <Stack gap={2}>
      <input ref={input} id="activity-file" type="file" multiple accept=".fit,.tcx,.gpx,application/vnd.ant.fit,application/gpx+xml,application/vnd.garmin.tcx+xml"
        className="ds-visually-hidden" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files)} />
      <Cluster><Button icon="watch" loading={busy} onClick={() => input.current?.click()}>{busy ? 'Lecture…' : items.length ? 'Ajouter une autre activité' : 'Importer depuis ma montre'}</Button></Cluster>
      <Text size="sm" muted>Fichier .fit, .tcx ou .gpx, un ou plusieurs (échauffement enregistré à part, montre coupée…). Ils restent sur ton appareil : seuls le sport, l’heure, la durée et la distance sont repris.</Text>
      {errors.length ? <Banner tone="danger">{errors.map((e, i) => <span key={i} className={s.line}>{e}</span>)}</Banner> : null}
      {items.length ? (
        <div className={s.done} role="status">
          <Text size="sm"><strong>{items.length > 1 ? `${items.length} activités rattachées` : 'Activité rattachée'}</strong>
            {items.length > 1 ? ' : durée et distance additionnées ci-dessous' : ' : durée et distance remplies ci-dessous'}, tu peux les corriger.</Text>
          <ul className={s.list}>
            {items.map((a) => {
              const local = a.startedAt ? utcToLocal(new Date(a.startedAt), timeZone) : null;
              const otherDay = local && local.date !== plannedDate;
              const otherSport = a.sport && a.sport !== plannedSport && !(plannedSport === 'trail' && a.sport === 'running');
              return (
                <li key={activityFingerprint(a)} className={s.item}>
                  <Icon name="watch" size={18} />
                  <span className={s.text}>
                    <span>{ACTIVITY_FORMAT_LABELS[a.format]} · {describe(a, timeZone)}</span>
                    {otherDay ? <span className={s.warn}>Activité du {formatLongDate(local!.date).toLowerCase()}, séance prévue le {formatLongDate(plannedDate).toLowerCase()}. Vérifie que c’est la bonne.</span> : null}
                    {otherSport ? <span className={s.warn}>Sport différent du prévu ({SPORT_LABELS[a.sport!]}) : précise-le dans « Ma séance était différente du prévu ».</span> : null}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((x) => x !== a))} aria-label={`Retirer l’activité ${describe(a, timeZone)}`}>Retirer</Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Stack>
  );
}
