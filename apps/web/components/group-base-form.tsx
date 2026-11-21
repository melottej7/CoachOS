'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SPORT_LABELS, SPORTS, type LibraryWorkout, type Sport } from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';
import { fromEditor, toEditor, WorkoutBuilder, type EBlock, type ExerciseOption } from './workout-builder';

// D-046 : modifier la base commune d’une séance de groupe. Répercutée sur les séances qui la suivent encore ;
// les séances adaptées ne changent pas ; rien n’est publié (la publication reste un geste explicite, plus bas).

export interface BaseRow { name: string; followsBase: boolean; published: boolean }

export function GroupBaseForm({ wid, gid, revision, base, rows, exercises }: { wid: string; gid: string; revision: number; base: LibraryWorkout; rows: BaseRow[]; exercises?: ExerciseOption[] }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ revision: number; updated: unknown[]; kept: { name: string }[] }>();
  const [title, setTitle] = useState(base.title);
  const [sport, setSport] = useState<Sport>(base.sport);
  const [instructions, setInstructions] = useState(base.instructions ?? '');
  const [blocks, setBlocks] = useState<EBlock[]>(() => toEditor(base.intervals ?? [], 'b'));
  const [done, setDone] = useState<string | null>(null);
  const first = (n: string) => n.split(' ')[0];
  const follow = rows.filter((r) => r.followsBase);
  const kept = rows.filter((r) => !r.followsBase);
  const republish = follow.filter((r) => r.published);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const workout = { sport, title, instructions: instructions || null, durationSeconds: null, distanceM: null, intervals: fromEditor(blocks) };
    const r = await run('PATCH', `/api/v1/workspaces/${wid}/group-sessions/${gid}`, { expectedRevision: revision, workout });
    if (r && r.revision === revision) { setDone('Aucun changement à enregistrer.'); return; }
    if (r) {
      setDone(`Base modifiée et répercutée sur ${r.updated.length} séance${r.updated.length > 1 ? 's' : ''}.${republish.length ? ' Publie-la ci-dessous pour que les élèves la voient.' : ''}`);
      router.refresh();
    }
  }

  const conflict = error?.kind === 'error' && error.code === 'CONFLICT_OR_QUOTA';
  return (
    <details className="card gb">
      <summary className="card-head"><h2>✏️ Modifier la base commune</h2><span className="muted">{follow.length} séance{follow.length > 1 ? 's' : ''} la sui{follow.length > 1 ? 'vent' : 't'}</span></summary>
      <form className="form card-body" onSubmit={save} noValidate>
        {done ? <p className="banner ok" role="status">{done}</p> : null}
        <ErrorSummary error={conflict ? null : error} />
        {conflict ? <p className="banner warn">La base a changé entre-temps. Ta saisie est conservée ; <a href="">recharge la page</a> pour repartir de la version actuelle.</p> : null}
        <div className="form-row">
          <div className="field"><label htmlFor="gb-title">Titre</label>
            <input id="gb-title" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!fieldError(error, 'workout.title')} />
            {fieldError(error, 'workout.title') ? <span className="field-error">{fieldError(error, 'workout.title')}</span> : null}</div>
          <div className="field"><label htmlFor="gb-sport">Sport</label>
            <select id="gb-sport" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{SPORTS.map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}</select></div>
        </div>
        <WorkoutBuilder sport={sport} value={blocks} onChange={setBlocks} exercises={exercises} />
        <div className="field"><label htmlFor="gb-instructions">Consignes <span className="hint">Facultatif</span></label>
          <textarea id="gb-instructions" maxLength={5000} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></div>
        <div className="gs-summary" aria-live="polite">
          <p><strong>Mise à jour pour {follow.length} élève{follow.length > 1 ? 's' : ''}</strong>{follow.length ? ` : ${follow.map((r) => first(r.name)).join(', ')}` : ''}.</p>
          {republish.length ? <p>Déjà publiée pour {republish.map((r) => first(r.name)).join(', ')} : l’élève garde l’ancienne version jusqu’à ce que tu republies.</p> : null}
          {kept.length ? <p className="muted">Inchangées (adaptées) : {kept.map((r) => first(r.name)).join(', ')}.</p> : null}
        </div>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={pending || !title.trim()}>
            {pending ? 'Enregistrement…' : `Enregistrer la base${follow.length ? ` pour ${follow.length} élève${follow.length > 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
      </form>
    </details>
  );
}
