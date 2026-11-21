'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { SPORTS, SPORT_LABELS, type Block, type References, type Sport, sportsFor, type Modules } from '@coachos/domain';
import { fromEditor, toEditor, WorkoutBuilder, type EBlock, type ExerciseOption, type SavedBlock } from './workout-builder';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';

export interface WorkoutFormValues {
  title: string;
  localDate: string;
  sport: Sport;
  minutes: string;
  instructions: string;
  intervals?: Block[];
}

interface Props {
  wid: string;
  aid: string;
  athleteName: string;
  timeZone: string;
  initial: WorkoutFormValues;
  /** Absent : création. Présent : nouvelle révision sur cette séance. */
  edit?: { sid: string; expectedRevision: number; published: boolean };
  cancelHref: string;
  /** Page où revenir après l’enregistrement (ex. séance de groupe, D-042). */
  returnTo?: string;
  /** Repères de l’athlète (VMA) : allures des zones et kilomètres estimés. */
  refs?: References;
  /** D-074 : blocs réutilisables du coach. */
  savedBlocks?: SavedBlock[];
  /** D-096 : exercices de la bibliothèque (séances de musculation). */
  exercises?: ExerciseOption[];
  /** D-102 : sports proposés selon les modules de l’espace. */
  modules?: Modules;
}

export function WorkoutForm({ wid, aid, athleteName, timeZone, initial, edit, cancelHref, refs, returnTo, savedBlocks, exercises, modules }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [blocks, setBlocks] = useState<EBlock[]>(() => toEditor(initial.intervals ?? [], 'i'));
  const { run, pending, error } = useIntent<{ id: string; workingRevision: number }>();
  const set = (k: keyof WorkoutFormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const minutes = values.minutes.trim() === '' ? null : Number(values.minutes);
    const data = {
      localDate: values.localDate,
      timeZone,
      sortOrder: 0,
      sport: values.sport,
      title: values.title,
      instructions: values.instructions,
      // Avec des blocs, le serveur calcule durée et distance à partir de la structure.
      durationSeconds: blocks.length || minutes === null || Number.isNaN(minutes) ? null : Math.round(minutes * 60),
      intervals: fromEditor(blocks),
    };
    const base = `/api/v1/workspaces/${wid}/athletes/${aid}/workouts`;
    const result = edit
      ? await run('PATCH', `${base}/${edit.sid}`, { expectedRevision: edit.expectedRevision, data })
      : await run('POST', base, { data });
    if (result) { router.push(returnTo ?? `/coach/${wid}/athletes/${aid}/workouts/${result.id}?notice=saved`); if (returnTo) router.refresh(); }
  }

  const err = (path: string) => fieldError(error, path);
  const conflict = error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA';

  return (
    <form className="form" onSubmit={submit} noValidate aria-describedby="form-context">
      <p id="form-context" className="muted">
        Pour {athleteName} · fuseau {timeZone}. {edit?.published ? 'La version publiée reste visible jusqu’à la republication.' : 'Le brouillon reste invisible pour l’athlète jusqu’à la publication.'}
      </p>
      <ErrorSummary error={error} onRetry={() => void submit()} />
      {conflict ? (
        <p className="banner warn">
          La séance a changé entre-temps. Ta saisie est conservée ici. <a href={cancelHref}>Voir la version actuelle</a> puis reprends ta modification.
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="title">Titre</label>
        <input id="title" name="title" required maxLength={120} autoFocus value={values.title} onChange={set('title')} placeholder="Footing facile"
          aria-invalid={!!err('data.title')} aria-describedby={err('data.title') ? 'title-error' : undefined} />
        {err('data.title') ? <span id="title-error" className="field-error">{err('data.title')}</span> : null}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="localDate">Date</label>
          <input id="localDate" type="date" required value={values.localDate} onChange={set('localDate')} aria-invalid={!!err('data.localDate')} />
          {err('data.localDate') ? <span className="field-error">{err('data.localDate')}</span> : null}
        </div>
        <div className="field">
          <label htmlFor="sport">Sport</label>
          <select id="sport" value={values.sport} onChange={set('sport')}>
            {sportsFor(modules ?? { endurance: true, strength: true }, values.sport).map((s) => (
              <option key={s} value={s}>{SPORT_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>
      <WorkoutBuilder strengthOn={modules?.strength ?? true} sport={values.sport} value={blocks} onChange={setBlocks} refs={refs} athleteFirst={athleteName.split(' ')[0] ?? athleteName} vmaHref={`/coach/${wid}/athletes/${aid}#refs-title`}
        library={savedBlocks ? { wid, blocks: savedBlocks } : undefined} exercises={exercises} />
      {blocks.length ? null : <div className="field">
        <label htmlFor="duration">Durée en minutes <span className="hint">Facultatif</span></label>
        <input id="duration" type="number" inputMode="numeric" min={1} max={1440} value={values.minutes} onChange={set('minutes')}
          aria-invalid={!!err('data.durationSeconds')} />
        {err('data.durationSeconds') ? <span className="field-error">{err('data.durationSeconds')}</span> : null}
      </div>}
      <div className="field">
        <label htmlFor="instructions">Consignes générales <span className="hint">Facultatif · ce que l’athlète lira en plus des blocs</span></label>
        <textarea id="instructions" maxLength={5000} value={values.instructions} onChange={set('instructions')} />
      </div>
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending} aria-disabled={pending} data-tour="save-draft">
          {pending ? 'Enregistrement…' : 'Enregistrer le brouillon'}
        </button>
        <a className="btn" href={cancelHref}>Annuler</a>
      </div>
    </form>
  );
}
