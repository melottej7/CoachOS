'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import {
  BASE_VIDEO_SOURCE_LABELS, BASE_VIDEOS, MACHINE_MOTIONS, MOTION_STATUS_LABELS, motionStatus, EXERCISE_CLIP_MAX_BYTES, EXERCISE_CLIP_STORAGE_MAX_BYTES, EXERCISE_CLIP_TYPES, EXERCISE_EQUIPMENT, EXERCISE_EQUIPMENT_LABELS, exerciseHasVideo, MUSCLE_LABELS, MUSCLE_SHORT, MUSCLES,
  type Exercise, type ExerciseEquipment, type Muscle,
} from '@coachos/domain';
import { mutate, newKey } from '@/components/api-client';
import { Badge, Banner, Button, Checkbox, ChipChecks, Cluster, EmptyState, Field, Grid, Heading, Input, Select, Stack, Text, Textarea } from '@/design';
import { ExerciseMedia } from '@/views/athlete/exercise-howto';
import s from './library.module.css';

// D-096, refonte Chrono (D-154) · Exercices de musculation du coach : chercher, créer, modifier, filmer ou lier une vidéo.

type Draft = { name: string; muscle: Muscle; equipment: ExerciseEquipment[]; instructions: string; videoUrl: string; useBaseVideo: boolean };
const empty: Draft = { name: '', muscle: 'legs', equipment: [], instructions: '', videoUrl: '', useBaseVideo: true };
const toDraft = (e: Exercise): Draft => ({ name: e.name, muscle: e.muscle, equipment: e.equipment, instructions: e.instructions ?? '', videoUrl: e.videoUrl ?? '', useBaseVideo: e.useBaseVideo });

export function ExerciseLibrary({ wid, items, ai = false }: { wid: string; items: Exercise[]; ai?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | ''>('');
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return items.filter((e) => (!muscle || e.muscle === muscle) && (!k || e.name.toLowerCase().includes(k) || (e.instructions ?? '').toLowerCase().includes(k)));
  }, [items, q, muscle]);
  const withVideo = items.filter((e) => exerciseHasVideo(e)).length;

  async function starter() {
    setBusy(true);
    const r = await mutate<{ added: number }>('POST', `/api/v1/workspaces/${wid}/exercises/starter`, {}, newKey());
    setBusy(false);
    setNote(r.ok ? { ok: true, text: `${r.data.added} exercice${r.data.added > 1 ? 's' : ''} de départ ajouté${r.data.added > 1 ? 's' : ''}. Ajoute tes vidéos au fil de l’eau.` } : { ok: false, text: 'Ajout impossible. Réessaie.' });
    router.refresh();
  }

  return (
    <Stack gap={5}>
      <Cluster between gap={3} align="end">
        <Text muted>{items.length} exercice{items.length > 1 ? 's' : ''}, dont {withVideo} avec vidéo. Tes élèves voient ta vidéo dans leur séance ; sans la tienne, la vidéo CoachOS quand elle existe.</Text>
        <Cluster gap={2}>
          {items.length < 10 ? <Button icon="plus" loading={busy} onClick={() => void starter()}>Ajouter les exercices de départ</Button> : null}
          <Button variant="primary" icon="plus" onClick={() => { setCreating(true); setOpen(null); }}>Nouvel exercice</Button>
        </Cluster>
      </Cluster>
      {note ? <Banner tone={note.ok ? 'success' : 'danger'}>{note.text}</Banner> : null}

      {creating ? (
        <div className={s.exNew}>
          <ExerciseForm wid={wid} ai={ai} initial={empty} onDone={(id) => { setCreating(false); if (id) setOpen(id); router.refresh(); }} />
        </div>
      ) : null}

      {items.length ? (
        <div className={s.filters}>
          <label className="ds-visually-hidden" htmlFor="ex-q">Chercher un exercice</label>
          <Input id="ex-q" type="search" placeholder="Chercher : squat, gainage, élastique…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="ds-visually-hidden" htmlFor="ex-muscle">Groupe musculaire</label>
          <Select id="ex-muscle" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | '')}>
            <option value="">Tous les groupes</option>
            {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_SHORT[m]}</option>)}
          </Select>
        </div>
      ) : null}

      {shown.length ? (
        <ul className={s.list}>
          {shown.map((e) => {
            const own = Boolean(e.clipId || e.videoUrl);
            return (
              <li key={e.id}>
                <button type="button" className={s.exRow} aria-expanded={open === e.id} onClick={() => { setOpen(open === e.id ? null : e.id); setCreating(false); }}>
                  <span className={s.exName}>{e.name}</span>
                  <span className={s.exMeta}>{MUSCLE_SHORT[e.muscle]}{e.equipment.length ? ` · ${e.equipment.map((x) => EXERCISE_EQUIPMENT_LABELS[x]).join(', ')}` : ''}</span>
                  {own ? <Badge tone="coach">Ta vidéo</Badge> : exerciseHasVideo(e) ? <Badge>Vidéo CoachOS</Badge>
                    : e.starterKey && e.useBaseVideo && motionStatus(e.starterKey) ? (
                      <Badge tone={motionStatus(e.starterKey) === 'validated' ? 'neutral' : 'warning'}>Animation {MOTION_STATUS_LABELS[motionStatus(e.starterKey)!].toLowerCase()}</Badge>
                    ) : null}
                </button>
                {open === e.id ? <div className={s.exOpen}><ExerciseForm wid={wid} ai={ai} initial={toDraft(e)} exercise={e} onDone={() => router.refresh()} /></div> : null}
              </li>
            );
          })}
        </ul>
      ) : items.length ? <Text muted>Aucun exercice pour cette recherche.</Text> : (
        <EmptyState icon="library" title="Aucun exercice pour l’instant">Ajoute les exercices de départ, puis complète-les avec tes consignes et tes vidéos.</EmptyState>
      )}
    </Stack>
  );
}

function ExerciseForm({ wid, ai = false, initial, exercise, onDone }: { wid: string; ai?: boolean; initial: Draft; exercise?: Exercise; onDone: (id?: string) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'uploading'>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [key, setKey] = useState(newKey());
  const file = useRef<HTMLInputElement>(null);
  // IA-5 (D-193) : consignes proposées « À relire », reprises dans le champ seulement si le coach le veut.
  const [cues, setCues] = useState<{ text: string; note: string; source: string } | null>(null);
  const [cuesState, setCuesState] = useState<'idle' | 'busy'>('idle');
  const [cuesError, setCuesError] = useState<string | null>(null);
  const [toReview, setToReview] = useState(false);
  async function proposeCues() {
    setCuesState('busy'); setCuesError(null); setCues(null);
    const r = await mutate<{ status: 'ready' | 'abstain'; text: string; note: string; source: string }>('POST', `/api/v1/workspaces/${wid}/ai-exercise`, { name: d.name, muscle: d.muscle, equipment: d.equipment }, newKey());
    setCuesState('idle');
    if (!r.ok) { setCuesError(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.'); return; }
    if (r.data.status === 'ready') setCues(r.data); else setCuesError(r.data.note || 'Pas de proposition pour cet exercice.');
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((x) => ({ ...x, [k]: v })); setSaved(null); };
  const body = { name: d.name, muscle: d.muscle, equipment: d.equipment, instructions: d.instructions || null, videoUrl: d.videoUrl || null, useBaseVideo: d.useBaseVideo };
  const base = exercise?.starterKey ? BASE_VIDEOS[exercise.starterKey] : undefined;
  const motion = exercise?.starterKey ? MACHINE_MOTIONS[exercise.starterKey] : undefined;
  const own = Boolean(exercise?.clipId || d.videoUrl);
  const id = exercise?.id ?? 'new';
  const preview = { id: exercise?.id ?? 'apercu', name: d.name || 'Exercice', videoUrl: d.videoUrl || null, clipId: exercise?.clipId ?? null, starterKey: exercise?.starterKey ?? null, useBaseVideo: d.useBaseVideo };

  async function save(archive = false) {
    setState('saving'); setError(null);
    const r = exercise
      ? await mutate<{ id: string }>('PATCH', `/api/v1/workspaces/${wid}/exercises/${exercise.id}`, { ...body, expectedRevision: exercise.revision, ...(archive ? { archive: true } : {}) }, key)
      : await mutate<{ id: string }>('POST', `/api/v1/workspaces/${wid}/exercises`, body, key);
    setState('idle');
    if (!r.ok) { setError(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.'); return; }
    setKey(newKey());
    setSaved(archive ? 'Exercice retiré.' : 'Enregistré.');
    setToReview(false);
    onDone(r.data.id);
  }

  async function upload(f: File) {
    if (!exercise) return;
    if (f.size > EXERCISE_CLIP_STORAGE_MAX_BYTES) { setError('Vidéo trop lourde (50 Mio au plus). Filme une minute au plus, ou mets un lien YouTube.'); return; }
    // Certains téléphones ne donnent pas le type : on le déduit de l’extension ; le serveur reconnaît ensuite la vidéo par son contenu.
    const type = (EXERCISE_CLIP_TYPES as readonly string[]).includes(f.type) ? f.type : /\.mov$/i.test(f.name) ? 'video/quicktime' : /\.webm$/i.test(f.name) ? 'video/webm' : 'video/mp4';
    const base = `/api/v1/workspaces/${wid}/exercises/${exercise.id}/video`;
    const fail = (r: { kind: 'network' } | { kind: 'error'; fields: { rule: string }[]; message: string }) => {
      setError(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.');
      setState('idle'); setProgress(null);
    };
    setState('uploading'); setError(null);
    // D-173 : en ligne, la vidéo part directement du téléphone vers le stockage privé, puis CoachOS la vérifie et la rattache.
    const start = await mutate<{ mode: 'server' } | { mode: 'direct'; clipId: string; uploadUrl: string }>('POST', `${base}/upload`, { contentType: type, size: f.size }, newKey());
    if (!start.ok) { fail(start); return; }
    if (start.data.mode === 'direct') {
      setProgress(0);
      const sent = await putFile(start.data.uploadUrl, f, type, setProgress);
      if (!sent) { setError('Envoi interrompu. Vérifie ta connexion, puis réessaie.'); setState('idle'); setProgress(null); return; }
      const done = await mutate('POST', `${base}/finish`, { clipId: start.data.clipId }, newKey());
      if (!done.ok) { fail(done); return; }
      setState('idle'); setProgress(null); setSaved('Vidéo enregistrée.'); onDone(exercise.id);
      return;
    }
    // Sans stockage (démonstration) : envoi à CoachOS, 25 Mio au plus.
    if (f.size > EXERCISE_CLIP_MAX_BYTES) { setError('Vidéo trop lourde (25 Mio au plus). Filme 10 à 30 secondes, ou mets un lien YouTube.'); setState('idle'); return; }
    try {
      const res = await fetch(base, { method: 'POST', body: f, credentials: 'same-origin', headers: { 'content-type': type } });
      // D-113 · Sur Vercel, un envoi de plus de 4,5 Mo est refusé avant d’atteindre CoachOS.
      if (res.status === 413) { setError('Vidéo trop lourde pour cet envoi (4 Mo au plus). Filme 10 à 15 secondes en qualité réduite, ou mets un lien YouTube.'); setState('idle'); return; }
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: { message?: string; fields?: { rule: string }[] } } | null;
        setError(p?.error?.fields?.[0]?.rule ?? p?.error?.message ?? 'Envoi impossible. Réessaie.');
      } else { setSaved('Vidéo enregistrée.'); onDone(exercise.id); }
    } catch { setError('Connexion perdue. Réessaie.'); }
    setState('idle');
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label={exercise ? `Modifier « ${exercise.name} »` : 'Nouvel exercice'}>
      <Stack gap={4}>
        {!exercise ? <Heading level={3} size={4}>Nouvel exercice</Heading> : null}
        <Grid min={200} gap={4}>
          <Field id={`ex-name-${id}`} label="Nom">
            <Input id={`ex-name-${id}`} required maxLength={80} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. Squat goblet" autoFocus={!exercise} />
          </Field>
          <Field id={`ex-muscle-${id}`} label="Groupe musculaire">
            <Select id={`ex-muscle-${id}`} value={d.muscle} onChange={(e) => set('muscle', e.target.value as Muscle)}>
              {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABELS[m]}</option>)}
            </Select>
          </Field>
        </Grid>
        <ChipChecks legend="Matériel" value={d.equipment} onChange={(v) => set('equipment', v)}
          options={EXERCISE_EQUIPMENT.map((x) => ({ value: x, label: EXERCISE_EQUIPMENT_LABELS[x] }))} />
        <Field id={`ex-instr-${id}`} label="Consignes" hint="Placement, respiration, erreurs à éviter, version plus facile">
          <Textarea id={`ex-instr-${id}`} rows={3} maxLength={1500} value={d.instructions} onChange={(e) => set('instructions', e.target.value)} hasHint />
        </Field>
        {ai ? (
          <Stack gap={2}>
            <Cluster gap={2}>
              <Button size="sm" icon="bolt" loading={cuesState === 'busy'} disabled={d.name.trim().length < 2} onClick={() => void proposeCues()}>Proposer les consignes</Button>
              {toReview ? <Badge tone="warning">À relire</Badge> : null}
            </Cluster>
            {cuesError ? <Text size="sm" tone="danger" role="alert">{cuesError}</Text> : null}
            {cues ? (
              <Stack gap={2} aria-live="polite">
                <Cluster gap={2}><Badge tone="warning">À relire</Badge><Badge tone={cues.source === 'claude' ? 'coach' : 'neutral'}>{cues.source === 'claude' ? 'Claude' : 'IA simulée'}</Badge></Cluster>
                <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{cues.text}</Text>
                {cues.note ? <Text size="sm" muted>{cues.note}</Text> : null}
                <Cluster gap={2}>
                  <Button size="sm" variant="primary" icon="check" onClick={() => { set('instructions', d.instructions.trim() ? `${d.instructions.trim()}\n${cues.text}`.slice(0, 1500) : cues.text); setToReview(true); setCues(null); }}>Reprendre dans les consignes</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCues(null)}>Écarter</Button>
                </Cluster>
              </Stack>
            ) : null}
          </Stack>
        ) : null}
        <Field id={`ex-url-${id}`} label="Lien de vidéo" hint="YouTube, Vimeo, Google Drive… (adresse en https://)">
          <Input id={`ex-url-${id}`} type="url" inputMode="url" maxLength={500} value={d.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://youtu.be/…" hasHint />
        </Field>
        {exercise ? (
          <Stack gap={1}>
            <Cluster gap={2}>
              <Button icon="upload" loading={state === 'uploading'} disabled={state !== 'idle'} onClick={() => file.current?.click()}>
                {exercise.clipId ? 'Remplacer ma vidéo' : 'Ajouter ma vidéo (filmée au téléphone)'}
              </Button>
              {exercise.clipId ? (
                <Button variant="ghost" icon="trash" disabled={state !== 'idle'} onClick={async () => {
                  if (!window.confirm('Retirer ta vidéo filmée de cet exercice ?')) return;
                  const r = await mutate('DELETE', `/api/v1/workspaces/${wid}/exercises/${exercise.id}/video`, {}, newKey());
                  if (r.ok) onDone(exercise.id); else setError('Retrait impossible. Réessaie.');
                }}>Retirer ma vidéo</Button>
              ) : null}
            </Cluster>
            <input ref={file} type="file" accept="video/mp4,video/quicktime,video/webm" capture="environment" className="ds-visually-hidden" tabIndex={-1} aria-hidden="true"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
            {progress !== null ? (
              <div className={s.upload} role="progressbar" aria-label="Envoi de la vidéo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <span style={{ inlineSize: `${Math.round(progress * 100)}%` }} />
              </div>
            ) : null}
            <Text size="sm" muted>{progress !== null ? `Envoi de la vidéo : ${Math.round(progress * 100)} %. Garde cette page ouverte.` : 'MP4 ou MOV, 50 Mio au plus (environ une minute). Visible seulement par toi et tes élèves.'}</Text>
          </Stack>
        ) : <Text size="sm" muted>Enregistre d’abord l’exercice ; tu pourras ensuite y ajouter ta propre vidéo filmée.</Text>}
        <Stack gap={2} as="fieldset" style={{ border: 0, margin: 0, padding: 0 }}>
          <Text as="legend" strong>Vidéo montrée à tes élèves</Text>
          {own ? <Text size="sm" muted>Ta vidéo : c’est toi que tes élèves voient.{base ? ' La vidéo CoachOS ne s’affiche pas tant que la tienne est là.' : ''}</Text>
            : base ? (
              <Checkbox id={`ex-base-${id}`} checked={d.useBaseVideo} onChange={(v) => set('useBaseVideo', v)}
                label="Montrer la vidéo CoachOS tant que je n’ai pas mis la mienne" hint={BASE_VIDEO_SOURCE_LABELS[base.source]} />
            ) : motion ? (
              <Checkbox id={`ex-base-${id}`} checked={d.useBaseVideo} onChange={(v) => set('useBaseVideo', v)}
                label="Montrer l’animation CoachOS tant que je n’ai pas mis ma vidéo"
                hint={motionStatus(motion.key) === 'validated' ? 'Animation validée' : 'Animation à relire : tes élèves la verront une fois validée par CoachOS'} />
            ) : <Text size="sm" muted>{exercise?.starterKey ? 'Pas encore de vidéo CoachOS pour cet exercice : ajoute la tienne, ou elle arrivera bientôt.' : 'Ajoute ta vidéo (lien ou fichier) : c’est toi que tes élèves verront.'}</Text>}
        </Stack>
        {own || ((base || motion) && d.useBaseVideo) ? <div className={s.media}><ExerciseMedia wid={wid} exercise={preview} coach /></div> : null}
        {error ? <Text size="sm" tone="danger" role="alert">{error}</Text> : null}
        {saved ? <Text size="sm" tone="success" role="status">{saved}</Text> : null}
        <Cluster gap={2}>
          <Button type="submit" variant="primary" icon="check" loading={state === 'saving'} disabled={state !== 'idle' || !d.name.trim()}>{exercise ? 'Enregistrer' : 'Créer l’exercice'}</Button>
          {!exercise ? <Button variant="ghost" onClick={() => onDone()}>Annuler</Button> : null}
          {exercise ? (
            <Button variant="ghost" icon="trash" disabled={state !== 'idle'} onClick={() => {
              if (window.confirm(`Retirer « ${exercise.name} » de ta bibliothèque ? Les séances qui l’utilisent le gardent.`)) void save(true);
            }}>Retirer l’exercice</Button>
          ) : null}
        </Cluster>
      </Stack>
    </form>
  );
}

/** D-173 · Envoi direct au stockage, avec l’avancement (fetch ne le donne pas). */
function putFile(url: string, f: File, type: string, onProgress: (p: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('content-type', type);
    x.setRequestHeader('x-upsert', 'false');
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => resolve(x.status >= 200 && x.status < 300);
    x.onerror = () => resolve(false);
    x.onabort = () => resolve(false);
    x.send(f);
  });
}
