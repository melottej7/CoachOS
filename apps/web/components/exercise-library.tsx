'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  BASE_VIDEO_SOURCE_LABELS, BASE_VIDEOS, EXERCISE_CLIP_MAX_BYTES, EXERCISE_EQUIPMENT, EXERCISE_EQUIPMENT_LABELS, MUSCLE_LABELS, MUSCLE_SHORT, MUSCLES,
  type Exercise, type ExerciseEquipment, type Muscle,
} from '@coachos/domain';
import { mutate, newKey } from './api-client';
import { ExerciseVideo, hasVideo } from './exercise-video';

// D-096 · Bibliothèque d’exercices du coach : chercher, créer, modifier, filmer ou lier une vidéo.

type Draft = { name: string; muscle: Muscle; equipment: ExerciseEquipment[]; instructions: string; videoUrl: string; useBaseVideo: boolean };
const empty: Draft = { name: '', muscle: 'legs', equipment: [], instructions: '', videoUrl: '', useBaseVideo: true };
const toDraft = (e: Exercise): Draft => ({ name: e.name, muscle: e.muscle, equipment: e.equipment, instructions: e.instructions ?? '', videoUrl: e.videoUrl ?? '', useBaseVideo: e.useBaseVideo });

export function ExerciseLibrary({ wid, items }: { wid: string; items: Exercise[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | ''>('');
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items.filter((e) => (!muscle || e.muscle === muscle) && (!k || e.name.toLowerCase().includes(k) || (e.instructions ?? '').toLowerCase().includes(k)));
  }, [items, q, muscle]);
  const withVideo = items.filter((e) => hasVideo(e)).length;

  return (
    <div className="stack">
      <div className="ex-tools">
        <label className="field ex-search"><span className="visually-hidden">Chercher un exercice</span>
          <input type="search" placeholder="Chercher : squat, gainage, élastique…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="field"><span className="visually-hidden">Groupe musculaire</span>
          <select value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | '')}>
            <option value="">Tous les groupes</option>
            {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_SHORT[m]}</option>)}
          </select></label>
        <span className="actions">
          {items.length < 10 ? (
            <button type="button" className="btn" disabled={busy} onClick={async () => {
              setBusy(true);
              const r = await mutate<{ added: number }>('POST', `/api/v1/workspaces/${wid}/exercises/starter`, {}, newKey());
              setBusy(false);
              setNote(r.ok ? `${r.data.added} exercice${r.data.added > 1 ? 's' : ''} de départ ajouté${r.data.added > 1 ? 's' : ''}. Ajoute tes vidéos au fil de l’eau.` : 'Ajout impossible. Réessaie.');
              router.refresh();
            }}>{busy ? 'Ajout…' : '✨ Ajouter les exercices de départ'}</button>
          ) : null}
          <button type="button" className="btn primary" onClick={() => { setCreating(true); setOpen(null); }}>+ Nouvel exercice</button>
        </span>
      </div>
      {note ? <p className="banner ok" role="status">{note}</p> : null}
      <p className="muted">{items.length} exercice{items.length > 1 ? 's' : ''}, dont {withVideo} avec vidéo. Tes élèves voient ta vidéo dans leur séance ; sans la tienne, la vidéo CoachOS quand elle existe.</p>

      {creating ? (
        <ExerciseForm wid={wid} initial={empty} onDone={(id) => { setCreating(false); if (id) setOpen(id); router.refresh(); }} />
      ) : null}

      {shown.length ? (
        <ul className="plain ex-list">
          {shown.map((e) => (
            <li key={e.id} className={`ex-item${open === e.id ? ' open' : ''}`}>
              <button type="button" className="ex-row" aria-expanded={open === e.id} onClick={() => { setOpen(open === e.id ? null : e.id); setCreating(false); }}>
                <span className="ex-name">{e.name}</span>
                <span className="ex-meta muted">{MUSCLE_SHORT[e.muscle]}{e.equipment.length ? ` · ${e.equipment.map((x) => EXERCISE_EQUIPMENT_LABELS[x]).join(', ')}` : ''}</span>
                <span className={`ex-badge${hasVideo(e) ? ' on' : ''}`}>{e.clipId || e.videoUrl ? '▶ ta vidéo' : hasVideo(e) ? '▶ vidéo CoachOS' : 'sans vidéo'}</span>
              </button>
              {open === e.id ? <ExerciseForm wid={wid} initial={toDraft(e)} exercise={e} onDone={() => router.refresh()} /> : null}
            </li>
          ))}
        </ul>
      ) : <p className="empty">{items.length ? 'Aucun exercice pour cette recherche.' : 'Aucun exercice pour l’instant. Ajoute les exercices de départ, puis complète-les avec tes vidéos.'}</p>}
    </div>
  );
}

function ExerciseForm({ wid, initial, exercise, onDone }: { wid: string; initial: Draft; exercise?: Exercise; onDone: (id?: string) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'uploading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [key, setKey] = useState(newKey());
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((x) => ({ ...x, [k]: v })); setSaved(null); };
  const body = { name: d.name, muscle: d.muscle, equipment: d.equipment, instructions: d.instructions || null, videoUrl: d.videoUrl || null, useBaseVideo: d.useBaseVideo };
  const preview = exercise ? { ...exercise, videoUrl: d.videoUrl || null, useBaseVideo: d.useBaseVideo } : { id: 'apercu', name: d.name || 'Exercice', videoUrl: d.videoUrl || null, clipId: null };
  const base = exercise?.starterKey ? BASE_VIDEOS[exercise.starterKey] : undefined;
  const own = Boolean(exercise?.clipId || d.videoUrl);

  async function save(archive = false) {
    setState('saving'); setError(null);
    const r = exercise
      ? await mutate<{ id: string }>('PATCH', `/api/v1/workspaces/${wid}/exercises/${exercise.id}`, { ...body, expectedRevision: exercise.revision, ...(archive ? { archive: true } : {}) }, key)
      : await mutate<{ id: string }>('POST', `/api/v1/workspaces/${wid}/exercises`, body, key);
    setState('idle');
    if (!r.ok) { setError(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.'); return; }
    setKey(newKey());
    setSaved(archive ? 'Exercice retiré.' : 'Enregistré.');
    onDone(r.data.id);
  }

  async function upload(file: File) {
    if (!exercise) return;
    if (file.size > EXERCISE_CLIP_MAX_BYTES) { setError('Vidéo trop lourde (25 Mio au plus). Filme 10 à 30 secondes, ou mets un lien YouTube.'); return; }
    setState('uploading'); setError(null);
    try {
      const res = await fetch(`/api/v1/workspaces/${wid}/exercises/${exercise.id}/video`, {
        method: 'POST', body: file, credentials: 'same-origin', headers: { 'content-type': file.type || 'application/octet-stream' },
      });
      // D-113 · En ligne (Vercel), un envoi de plus de 4,5 Mo est refusé avant d’atteindre CoachOS.
      if (res.status === 413) { setError('Vidéo trop lourde pour l’envoi en ligne (4 Mo au plus pour l’instant). Filme 10 à 15 secondes en qualité réduite, ou mets un lien YouTube.'); setState('idle'); return; }
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: { rule: string }[] } } | null;
        setError(p?.error?.fields?.[0]?.rule ?? p?.error?.message ?? 'Envoi impossible. Réessaie.');
      } else { setSaved('Vidéo enregistrée.'); onDone(exercise.id); }
    } catch { setError('Connexion perdue. Réessaie.'); }
    setState('idle');
  }

  return (
    <form className="ex-form stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      {!exercise ? <h3>Nouvel exercice</h3> : null}
      <div className="form-row">
        <label className="field"><span>Nom</span><input required maxLength={80} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Squat goblet" /></label>
        <label className="field"><span>Groupe musculaire</span>
          <select value={d.muscle} onChange={(e) => set('muscle', e.target.value as Muscle)}>
            {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
          </select></label>
      </div>
      <fieldset className="choice ex-equip"><legend>Matériel</legend>
        {EXERCISE_EQUIPMENT.map((x) => (
          <label key={x} className="check"><input type="checkbox" checked={d.equipment.includes(x)}
            onChange={() => set('equipment', d.equipment.includes(x) ? d.equipment.filter((y) => y !== x) : [...d.equipment, x])} /> <span>{EXERCISE_EQUIPMENT_LABELS[x]}</span></label>
        ))}
      </fieldset>
      <label className="field"><span>Consignes <span className="hint">Placement, respiration, erreurs à éviter, version plus facile</span></span>
        <textarea rows={3} maxLength={1500} value={d.instructions} onChange={(e) => set('instructions', e.target.value)} /></label>
      <label className="field"><span>Lien de vidéo <span className="hint">YouTube, Vimeo, Google Drive… (adresse en https://)</span></span>
        <input type="url" inputMode="url" maxLength={500} value={d.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://youtu.be/…" /></label>
      {exercise ? (
        <div className="ex-upload">
          <label className="btn small">
            {state === 'uploading' ? 'Envoi de la vidéo…' : exercise.clipId ? '🎥 Remplacer ma vidéo' : '🎥 Ajouter ma vidéo (filmée au téléphone)'}
            <input type="file" accept="video/mp4,video/quicktime,video/webm" capture="environment" className="visually-hidden" disabled={state !== 'idle'}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
          </label>
          <span className="muted">MP4 ou MOV, 25 Mio au plus (environ 30 secondes). Visible seulement par toi et tes élèves.</span>
        </div>
      ) : <p className="muted">Enregistre d’abord l’exercice ; tu pourras ensuite y ajouter ta propre vidéo filmée.</p>}
      <fieldset className="choice ex-source"><legend>Vidéo montrée à tes élèves</legend>
        {own ? <p className="muted">Ta vidéo : c’est toi que tes élèves voient.{base ? ' La vidéo CoachOS ne s’affiche pas tant que la tienne est là.' : ''}</p>
          : base ? (
            <label className="check"><input type="checkbox" checked={d.useBaseVideo} onChange={(e) => set('useBaseVideo', e.target.checked)} />
              <span>Montrer la vidéo CoachOS tant que je n’ai pas mis la mienne <span className="hint">({BASE_VIDEO_SOURCE_LABELS[base.source]})</span></span></label>
          ) : <p className="muted">{exercise?.starterKey ? 'Pas encore de vidéo CoachOS pour cet exercice : ajoute la tienne, ou elle arrivera bientôt.' : 'Ajoute ta vidéo (lien ou fichier) : c’est toi que tes élèves verront.'}</p>}
      </fieldset>
      {own || (base && d.useBaseVideo) ? <ExerciseVideo wid={wid} exercise={preview} compact /> : null}
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {saved ? <p className="muted" role="status">{saved}</p> : null}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={state !== 'idle' || !d.name.trim()}>{state === 'saving' ? 'Enregistrement…' : exercise ? 'Enregistrer' : 'Créer l’exercice'}</button>
        {!exercise ? <button type="button" className="btn ghost" onClick={() => onDone()}>Annuler</button> : null}
        {exercise?.clipId ? (
          <button type="button" className="link-btn" disabled={state !== 'idle'} onClick={async () => {
            if (!window.confirm('Retirer ta vidéo filmée de cet exercice ?')) return;
            const r = await mutate('DELETE', `/api/v1/workspaces/${wid}/exercises/${exercise.id}/video`, {}, newKey());
            if (r.ok) onDone(exercise.id); else setError('Retrait impossible. Réessaie.');
          }}>Retirer ma vidéo</button>
        ) : null}
        {exercise ? (
          <button type="button" className="link-btn" disabled={state !== 'idle'} onClick={() => {
            if (window.confirm(`Retirer « ${exercise.name} » de ta bibliothèque ? Les séances qui l’utilisent le gardent.`)) void save(true);
          }}>Retirer l’exercice</button>
        ) : null}
      </div>
    </form>
  );
}
