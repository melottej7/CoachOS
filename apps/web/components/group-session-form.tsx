'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatLongDate, SPORT_LABELS, SPORTS, type LibraryWorkout, type Sport, sportsFor, type Modules } from '@coachos/domain';
import { ErrorSummary } from './feedback-banners';
import { fieldError, useIntent } from './use-intent';
import { fromEditor, toEditor, WorkoutBuilder, type EBlock, type ExerciseOption } from './workout-builder';

// Lot G2 (D-042) : une base commune → un brouillon par élève choisi. Liste exacte des destinataires avant création.

export interface Recipient { id: string; name: string; state: 'invited' | 'active' }

export function GroupSessionForm({ wid, teamId, teamName, members, date, initial, exercises, modules }: {
  modules?: Modules;
  exercises?: ExerciseOption[];
  wid: string; teamId: string; teamName: string; members: Recipient[]; date: string; initial?: LibraryWorkout;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ id: string }>();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [sport, setSport] = useState<Sport>(initial?.sport ?? 'running');
  const [localDate, setLocalDate] = useState(date);
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [blocks, setBlocks] = useState<EBlock[]>(() => toEditor(initial?.intervals ?? [], 'i'));
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(members.map((m) => m.id)));
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = members.filter((m) => chosen.has(m.id));
  const left = members.filter((m) => !chosen.has(m.id));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const workout = { sport, title, instructions: instructions || null, durationSeconds: null, distanceM: null, intervals: fromEditor(blocks) };
    const r = await run('POST', `/api/v1/workspaces/${wid}/group-sessions`, { teamId, localDate, workout, athleteIds: picked.map((m) => m.id) });
    if (r) { router.push(`/coach/${wid}/groups/${teamId}/sessions/${r.id}`); router.refresh(); }
  }

  return (
    <form className="form" onSubmit={save} noValidate>
      <ErrorSummary error={error} />
      <div className="form-row">
        <div className="field"><label htmlFor="gs-date">Date</label>
          <input id="gs-date" type="date" required value={localDate} onChange={(e) => setLocalDate(e.target.value)} aria-invalid={!!fieldError(error, 'localDate')} />
          <span className="hint">À l’heure locale de chaque élève</span></div>
        <div className="field"><label htmlFor="gs-sport">Sport</label>
          <select id="gs-sport" value={sport} onChange={(e) => setSport(e.target.value as Sport)}>{sportsFor(modules ?? { endurance: true, strength: true }, sport).map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}</select></div>
      </div>
      <div className="field"><label htmlFor="gs-title">Titre</label>
        <input id="gs-title" maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Piste : 10 × 400 m" aria-invalid={!!fieldError(error, 'workout.title')} />
        {fieldError(error, 'workout.title') ? <span className="field-error">{fieldError(error, 'workout.title')}</span> : null}
      </div>
      <WorkoutBuilder strengthOn={modules?.strength ?? true} sport={sport} value={blocks} onChange={setBlocks} exercises={exercises} />
      <div className="field"><label htmlFor="gs-instructions">Consignes <span className="hint">Facultatif · identiques pour tous, modifiables ensuite par élève</span></label>
        <textarea id="gs-instructions" maxLength={5000} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></div>

      <fieldset className="gs-recipients">
        <legend>Destinataires · {teamName}</legend>
        <p className="hint">Un brouillon sera créé pour chaque élève coché. Rien n’est envoyé avant la publication.</p>
        <ul className="plain gs-list">
          {members.map((m) => (
            <li key={m.id}>
              <label className="check">
                <input type="checkbox" checked={chosen.has(m.id)} onChange={() => toggle(m.id)} />
                <span>{m.name}{m.state === 'invited' ? <span className="muted"> · pas encore connecté·e, verra la séance en rejoignant</span> : null}</span>
              </label>
            </li>
          ))}
        </ul>
        {fieldError(error, 'athleteIds') ? <span className="field-error">{fieldError(error, 'athleteIds')}</span> : null}
      </fieldset>

      <div className="gs-summary" aria-live="polite">
        <p><strong>{picked.length} brouillon{picked.length > 1 ? 's' : ''}</strong> le {localDate ? formatLongDate(localDate).toLowerCase() : '…'} : {picked.map((m) => m.name.split(' ')[0]).join(', ') || 'personne'}.</p>
        {left.length ? <p className="muted">Sans cette séance : {left.map((m) => m.name.split(' ')[0]).join(', ')}.</p> : null}
      </div>
      <div className="actions">
        <button className="btn primary" type="submit" disabled={pending || !picked.length || !title.trim()}>
          {pending ? 'Création…' : `Créer ${picked.length} brouillon${picked.length > 1 ? 's' : ''}`}
        </button>
        <a className="btn" href={`/coach/${wid}/group-sessions`}>Annuler</a>
      </div>
    </form>
  );
}
