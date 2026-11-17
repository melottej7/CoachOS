'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { DIFFICULTIES, DIFFICULTY_LABELS, FEELING_LABELS, RESULT_STATES, RESULT_STATE_LABELS, type Difficulty, type ResultState } from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';

interface Props {
  wid: string;
  aid: string;
  sid: string;
  publishedRevision: number;
  plannedMinutes: number | null;
  workspaceName: string;
  existing: { revision: number; state: ResultState; durationSeconds: number | null; rpe: number | null; comment: string | null; overallFeeling: number | null; difficulties: Difficulty[] } | null;
}

/**
 * X43 : retour en quelques gestes, à une main. Seul l’état est requis.
 * La saisie reste en mémoire si le réseau coupe ; « Réessayer » rejoue avec la même clé.
 */
export function FeedbackForm({ wid, aid, sid, publishedRevision, plannedMinutes, workspaceName, existing }: Props) {
  const router = useRouter();
  const [state, setState] = useState<ResultState | ''>(existing?.state ?? '');
  const [minutes, setMinutes] = useState(existing?.durationSeconds ? String(Math.round(existing.durationSeconds / 60)) : '');
  const [rpe, setRpe] = useState(existing?.rpe === null || existing?.rpe === undefined ? '' : String(existing.rpe));
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [feeling, setFeeling] = useState<number | null>(existing?.overallFeeling ?? null);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(existing?.difficulties ?? []);
  const [missingState, setMissingState] = useState(false);
  const { run, pending, error } = useIntent<{ item: { id: string; revision: number } }>();

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!state) {
      setMissingState(true);
      document.getElementById('state-completed')?.focus();
      return;
    }
    const m = minutes.trim() === '' ? null : Number(minutes);
    const body = {
      publishedRevision,
      expectedRevision: existing?.revision ?? null,
      state,
      durationSeconds: state === 'missed' || state === 'postponed' || m === null || Number.isNaN(m) ? null : Math.round(m * 60),
      distanceM: null,
      rpe: rpe === '' ? null : Number(rpe),
      comment,
      overallFeeling: feeling,
      difficulties,
    };
    const done = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/feedback`, body);
    if (done) {
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

      {state !== 'missed' && state !== 'postponed' ? (
        <div className="field">
          <label htmlFor="duration">
            Durée réalisée en minutes <span className="hint">Facultatif{plannedMinutes ? ` · prévu ${plannedMinutes} min` : ''}</span>
          </label>
          <input id="duration" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)}
            aria-invalid={!!err('durationSeconds')} />
          {err('durationSeconds') ? <span className="field-error">{err('durationSeconds')}</span> : null}
        </div>
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
