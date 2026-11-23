'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, SPORT_LABELS, SPORTS, type LibraryCategory, type LibraryWorkout, type Sport, sportsFor, type Modules } from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';
import { fromEditor, toEditor, WorkoutBuilder, type EBlock, type ExerciseOption, type SavedBlock } from '@/views/coach/workout/builder';

/** Créer ou modifier une séance de bibliothèque (D-035) : titre, sport, catégorie, consignes, déroulé par blocs. */
export function LibraryForm({ wid, initial, savedBlocks, exercises, modules }: {
  modules?: Modules;
  wid: string;
  savedBlocks?: SavedBlock[];
  exercises?: ExerciseOption[];
  initial?: { id: string; revision: number; category: LibraryCategory; workout: LibraryWorkout };
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ id: string; revision: number }>();
  const [title, setTitle] = useState(initial?.workout.title ?? '');
  const [sport, setSport] = useState<Sport>(initial?.workout.sport ?? 'running');
  const [category, setCategory] = useState<LibraryCategory>(initial?.category ?? 'other');
  const [instructions, setInstructions] = useState(initial?.workout.instructions ?? '');
  const [blocks, setBlocks] = useState<EBlock[]>(() => toEditor(initial?.workout.intervals ?? [], 'i'));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const workout = { sport, title, instructions: instructions || null, durationSeconds: null, distanceM: null, intervals: fromEditor(blocks) };
    const r = initial
      ? await run('PATCH', `/api/v1/workspaces/${wid}/templates/${initial.id}`, { expectedRevision: initial.revision, category, workout })
      : await run('POST', `/api/v1/workspaces/${wid}/templates`, { category, workout });
    if (r) { router.push(`/coach/${wid}/library`); router.refresh(); }
  }

  return (
    <form className="form" onSubmit={save} noValidate>
      <ErrorSummary error={error} />
      <div className="field"><label htmlFor="lib-title">Titre</label>
        <input id="lib-title" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Fractionné 10 × 400 m" aria-invalid={!!fieldError(error, 'workout.title')} />
        {fieldError(error, 'workout.title') ? <span className="field-error">{fieldError(error, 'workout.title')}</span> : null}
      </div>
      <div className="form-row">
        <div className="field"><label htmlFor="lib-sport">Sport</label>
          <select id="lib-sport" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{sportsFor(modules ?? { endurance: true, strength: true }, sport).map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}</select></div>
        <div className="field"><label htmlFor="lib-category">Catégorie</label>
          <select id="lib-category" value={category} onChange={(e) => setCategory(e.target.value as LibraryCategory)}>{LIBRARY_CATEGORIES.map((c) => <option key={c} value={c}>{LIBRARY_CATEGORY_LABELS[c]}</option>)}</select></div>
      </div>
      <WorkoutBuilder strengthOn={modules?.strength ?? true} sport={sport} value={blocks} onChange={setBlocks} library={savedBlocks ? { wid, blocks: savedBlocks } : undefined} exercises={exercises} />
      <div className="field"><label htmlFor="lib-instructions">Consignes <span className="hint">Facultatif · reprises dans chaque séance créée à partir de celle-ci</span></label>
        <textarea id="lib-instructions" maxLength={5000} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></div>
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Enregistrement…' : initial ? 'Enregistrer les modifications' : 'Ajouter à la bibliothèque'}</button>
        <a className="btn" href={`/coach/${wid}/library`}>Annuler</a>
      </div>
    </form>
  );
}
