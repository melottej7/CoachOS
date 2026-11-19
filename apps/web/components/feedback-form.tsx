'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  CHANGES, CHANGE_LABELS, describeBlock, DIFFICULTIES, DIFFICULTY_LABELS, FEELING_LABELS, RESULT_STATES, RESULT_STATE_LABELS, SPORTS, SPORT_LABELS,
  type Block, type Change, type Difficulty, type ResultState, type Sport,
} from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { ActivityImport } from './activity-import';
import { fieldError, useIntent } from './use-intent';

interface Props {
  wid: string;
  aid: string;
  sid: string;
  publishedRevision: number;
  plannedMinutes: number | null;
  workspaceName: string;
  /** Déroulé prévu : sert à demander les répétitions faites par série. */
  intervals: Block[];
  sport: Sport;
  /** Date prévue et fuseau de l’élève : vérifier qu’une activité importée est la bonne (D-048). */
  plannedDate: string;
  timeZone: string;
  existing: {
    revision: number; state: ResultState; durationSeconds: number | null; distanceM: number | null; rpe: number | null; comment: string | null;
    overallFeeling: number | null; difficulties: Difficulty[]; changes: Change[]; actualSport: Sport | null; repeatsDone: number[];
    measureFile: 'fit' | 'tcx' | 'gpx' | null;
  } | null;
}

/**
 * X43 : retour en quelques gestes, à une main. Seul l’état est requis.
 * La saisie reste en mémoire si le réseau coupe ; « Réessayer » rejoue avec la même clé.
 */
export function FeedbackForm({ wid, aid, sid, publishedRevision, plannedMinutes, workspaceName, intervals, sport, plannedDate, timeZone, existing }: Props) {
  const router = useRouter();
  const [state, setState] = useState<ResultState | ''>(existing?.state ?? '');
  const [minutes, setMinutes] = useState(existing?.durationSeconds ? String(Math.round(existing.durationSeconds / 60)) : '');
  const [rpe, setRpe] = useState(existing?.rpe === null || existing?.rpe === undefined ? '' : String(existing.rpe));
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [feeling, setFeeling] = useState<number | null>(existing?.overallFeeling ?? null);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(existing?.difficulties ?? []);
  const [km, setKm] = useState(existing?.distanceM ? String(existing.distanceM / 1000).replace('.', ',') : '');
  const [changes, setChanges] = useState<Change[]>(existing?.changes ?? []);
  const [actualSport, setActualSport] = useState<Sport | ''>(existing?.actualSport ?? '');
  const repeats = intervals.filter((b): b is Extract<Block, { type: 'repeat' }> => b.type === 'repeat');
  const [repsText, setRepsText] = useState<string[]>(() => repeats.map((_, i) => (existing?.repeatsDone[i] === undefined ? '' : String(existing.repeatsDone[i]))));
  const [missingState, setMissingState] = useState(false);
  // Provenance (D-048) : mesures lues dans un fichier, tant que l’élève ne les modifie pas.
  const kmText = (m: number | null) => (m ? String(Math.round(m / 10) / 100).replace('.', ',') : '');
  const [imported, setImported] = useState<{ file: 'fit' | 'tcx' | 'gpx'; minutes: string; km: string } | null>(
    existing?.measureFile ? { file: existing.measureFile, minutes: existing.durationSeconds ? String(Math.round(existing.durationSeconds / 60)) : '', km: existing.distanceM ? String(existing.distanceM / 1000).replace('.', ',') : '' } : null,
  );
  const { run, pending, error } = useIntent<{ item: { id: string; revision: number } }>();

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!state) {
      setMissingState(true);
      document.getElementById('state-completed')?.focus();
      return;
    }
    const m = minutes.trim() === '' ? null : Number(minutes);
    const done = state === 'completed' || state === 'partial';
    const dist = km.trim() === '' ? null : Number(km.replace(',', '.'));
    // Répétitions : si une série est renseignée, les autres valent le prévu.
    const repeatsDone = done && repsText.some((t) => t.trim() !== '')
      ? repeats.map((r, i) => (repsText[i]!.trim() === '' ? r.times : Math.max(0, Math.min(50, Math.round(Number(repsText[i]) || 0)))))
      : [];
    const body = {
      publishedRevision,
      expectedRevision: existing?.revision ?? null,
      state,
      durationSeconds: state === 'missed' || state === 'postponed' || m === null || Number.isNaN(m) ? null : Math.round(m * 60),
      distanceM: done && dist !== null && !Number.isNaN(dist) && dist > 0 ? Math.round(dist * 1000) : null,
      rpe: rpe === '' ? null : Number(rpe),
      comment,
      overallFeeling: feeling,
      difficulties,
      changes: done ? changes : [],
      actualSport: done && changes.includes('other_sport') && actualSport ? actualSport : null,
      repeatsDone,
      measureFile: done && imported && imported.minutes === minutes && imported.km === km && (minutes || km) ? imported.file : null,
    };
    const sent = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/feedback`, body);
    if (sent) {
      router.push(`/athlete/${wid}/workouts/${sid}?notice=sent`);
      router.refresh();
    }
  }

  const conflict = error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA';
  const err = (p: string) => fieldError(error, p);

  return (
    <form className="form" onSubmit={submit} noValidate>
      <ErrorSummary error={error} onRetry={() => void submit()} retryLabel="Renvoyer mon retour" />
      {conflict ? (
        <p className="banner warn">
          {error.kind === 'error' ? error.message : ''} Ta saisie est conservée ici.{' '}
          <a href={`/athlete/${wid}/workouts/${sid}`}>Relire la séance</a>
        </p>
      ) : null}

      <fieldset className="choice" aria-describedby={missingState ? 'state-error' : undefined}>
        <legend>As-tu fait cette séance ?</legend>
        {missingState && !state ? <span id="state-error" className="field-error" role="alert">Choisis une réponse pour envoyer ton retour.</span> : null}
        {RESULT_STATES.map((s) => (
          <label key={s}>
            <input type="radio" id={`state-${s}`} name="state" value={s} checked={state === s} onChange={() => setState(s)} />
            {RESULT_STATE_LABELS[s]}
          </label>
        ))}
      </fieldset>

      {state === 'completed' || state === 'partial' ? (
        <>
          <ActivityImport plannedDate={plannedDate} plannedSport={sport} timeZone={timeZone} onRead={(s) => {
            const mm = s.seconds ? String(Math.round(s.seconds / 60)) : '';
            const kk = kmText(s.distanceM);
            setMinutes(mm); setKm(kk); setImported({ file: s.format, minutes: mm, km: kk });
          }} />
          <div className="form-row">
            <div className="field">
              <label htmlFor="duration">
                Durée réalisée en minutes <span className="hint">Facultatif{plannedMinutes ? ` · prévu ${plannedMinutes} min` : ''}</span>
              </label>
              <input id="duration" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)}
                aria-invalid={!!err('durationSeconds')} />
              {err('durationSeconds') ? <span className="field-error">{err('durationSeconds')}</span> : null}
            </div>
            <div className="field">
              <label htmlFor="distance">Distance réalisée en km <span className="hint">Facultatif</span></label>
              <input id="distance" inputMode="decimal" placeholder="8,5" value={km} onChange={(e) => setKm(e.target.value)} aria-invalid={!!err('distanceM')} />
              {err('distanceM') ? <span className="field-error">{err('distanceM')}</span> : null}
            </div>
          </div>

          <details className="changed" open={state === 'partial' || changes.length > 0 || repsText.some((t) => t !== '')}>
            <summary>{state === 'partial' ? 'Qu’est-ce qui a changé ?' : 'Ma séance était différente du prévu'} <span className="hint">Facultatif · aide ton coach à ajuster</span></summary>
            <fieldset className="choice">
              <legend className="visually-hidden">Ce qui a changé</legend>
              <div className="chips">
                {CHANGES.map((c) => (
                  <label key={c}><input type="checkbox" checked={changes.includes(c)}
                    onChange={() => setChanges((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))} /> {CHANGE_LABELS[c]}</label>
                ))}
              </div>
            </fieldset>
            {changes.includes('other_sport') ? (
              <div className="field">
                <label htmlFor="actual-sport">Sport pratiqué à la place</label>
                <select id="actual-sport" className="select" value={actualSport} onChange={(e) => setActualSport(e.target.value as Sport | '')}>
                  <option value="">Choisir…</option>
                  {SPORTS.filter((x) => x !== sport).map((x) => <option key={x} value={x}>{SPORT_LABELS[x]}</option>)}
                </select>
              </div>
            ) : null}
            {repeats.length ? (
              <fieldset className="choice">
                <legend>Répétitions faites <span className="hint">Laisse vide si tout a été fait</span></legend>
                {repeats.map((r, i) => (
                  <div className="reps-row" key={i}>
                    <label htmlFor={`reps-${i}`}>{describeBlock(r, sport)}</label>
                    <span className="b-inline">
                      <input id={`reps-${i}`} className="num" type="number" inputMode="numeric" min={0} max={r.times} placeholder={String(r.times)} value={repsText[i]}
                        onChange={(e) => setRepsText((cur) => cur.map((t, j) => (j === i ? e.target.value : t)))} /> sur {r.times}
                    </span>
                  </div>
                ))}
              </fieldset>
            ) : null}
          </details>
        </>
      ) : null}

      <fieldset className="choice">
        <legend>Effort ressenti de 0 (très facile) à 10 (maximal) <span className="hint">Facultatif</span></legend>
        <div className="rpe">
          {Array.from({ length: 11 }, (_, i) => String(i)).map((v) => (
            <label key={v}>
              <input type="radio" name="rpe" value={v} checked={rpe === v} onChange={() => setRpe(v)} />
              {v}
            </label>
          ))}
        </div>
        <label style={{ justifyContent: 'flex-start', minHeight: 44 }}>
          <input type="radio" id="rpe-none" name="rpe" value="" checked={rpe === ''} onChange={() => setRpe('')} />
          Je préfère ne pas noter
        </label>
      </fieldset>

      <fieldset className="choice">
        <legend>Ressenti général <span className="hint">Facultatif</span></legend>
        <div className="chips">
          {([1, 2, 3, 4, 5] as const).map((v) => (
            <label key={v}><input type="radio" name="feeling" checked={feeling === v} onChange={() => setFeeling(v)} /> {FEELING_LABELS[v]}</label>
          ))}
          {feeling !== null ? <button type="button" className="link-btn" onClick={() => setFeeling(null)}>Effacer</button> : null}
        </div>
      </fieldset>

      <fieldset className="choice">
        <legend>Une difficulté particulière ? <span className="hint">Facultatif</span></legend>
        <div className="chips">
          {DIFFICULTIES.map((d) => (
            <label key={d}><input type="checkbox" checked={difficulties.includes(d)}
              onChange={() => setDifficulties((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))} /> {DIFFICULTY_LABELS[d]}</label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="comment">Commentaire <span className="hint">Facultatif · lu par ton coach ({workspaceName})</span></label>
        <textarea id="comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>

      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? 'Envoi…' : existing ? 'Enregistrer la correction' : 'Envoyer le retour'}
        </button>
        <a className="btn" href={`/athlete/${wid}/workouts/${sid}`}>Retour à la séance</a>
      </div>
    </form>
  );
}
