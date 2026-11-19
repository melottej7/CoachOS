'use client';

import { useState } from 'react';
import { LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, type LibraryCategory } from '@coachos/domain';
import { mutate, newKey } from './api-client';

/** Ajouter la séance à la bibliothèque du coach (D-035), avec sa catégorie. */
export function SaveToLibrary({ wid, aid, sid }: { wid: string; aid: string; sid: string }) {
  const [state, setState] = useState<'idle' | 'open' | 'sending' | 'done' | 'error'>('idle');
  const [category, setCategory] = useState<LibraryCategory>('other');
  if (state === 'done') return <a className="btn" href={`/coach/${wid}/library`}>✓ Dans la bibliothèque</a>;
  if (state === 'idle') return <button type="button" className="btn" onClick={() => setState('open')}>📚 Ajouter à la bibliothèque</button>;
  return (
    <span className="inline-form">
      <label className="visually-hidden" htmlFor="lib-cat">Catégorie</label>
      <select id="lib-cat" className="select small" value={category} onChange={(e) => setCategory(e.target.value as LibraryCategory)}>
        {LIBRARY_CATEGORIES.map((c) => <option key={c} value={c}>{LIBRARY_CATEGORY_LABELS[c]}</option>)}
      </select>
      <button type="button" className="btn primary small" disabled={state === 'sending'} onClick={async () => {
        setState('sending');
        const r = await mutate('POST', `/api/v1/workspaces/${wid}/athletes/${aid}/workouts/${sid}/template`, { category }, newKey());
        setState(r.ok ? 'done' : 'error');
      }}>Ajouter</button>
      {state === 'error' ? <span className="field-error" role="alert">Ajout impossible. Réessaie.</span> : null}
    </span>
  );
}
