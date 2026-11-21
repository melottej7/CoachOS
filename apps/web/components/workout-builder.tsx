'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  describeBlock, describeTotals, formatClock, formatKm, formatPace, PHASES, PHASE_LABELS, presetsFor, SPORTS, SPORT_LABELS, stepEstimate,
  personalTarget, sessionProfile, structureTotals, usesCss, usesFtp, usesVma, ZONE_NAMES, ZONES,
  type Block, type Intensity, type Measure, type Phase, type References, type Sport, type Step, type Zone,
} from '@coachos/domain';
import { SessionChart } from './session-chart';
import { QuickNotation } from './quick-notation';
import { canDrop, find, lift, moveBlock, shift, type DropTarget } from './block-tree';
import { mutate, newKey } from './api-client';

/** D-096 : exercices de la bibliothèque du coach, proposés dans les blocs de musculation. */
export interface ExerciseOption { id: string; name: string }
const ExercisesCtx = createContext<ExerciseOption[]>([]);

/** Bloc réutilisable de la bibliothèque du coach (D-074). */
export interface SavedBlock { id: string; title: string; sport: Sport | null; blocks: Block[] }

/** D-074 : ajouter une partie de la séance à la bibliothèque comme bloc réutilisable (échauffement type, série type…). D-094 : « ajouter », pas « garder ». */
function KeepBlocks({ wid, sport, blocks, onSaved }: { wid: string; sport: Sport; blocks: Block[]; onSaved: (b: SavedBlock) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [anySport, setAnySport] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | string>('idle');
  const ref = useRef<HTMLDetailsElement>(null);
  if (!blocks.length) return null;
  return (
    <details className="b-keep" ref={ref}>
      <summary className="link-btn">💾 Ajouter des blocs à ma bibliothèque</summary>
      <div className="stack">
        <fieldset className="choice"><legend>Blocs à ajouter</legend>
          {blocks.map((b, i) => (
            <label key={i} className="check"><input type="checkbox" aria-label={`Ajouter : ${describeBlock(b, sport)}`} checked={picked.includes(i)} onChange={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort((a, z) => a - z)))} /> <span>{describeBlock(b, sport)}</span></label>
          ))}
        </fieldset>
        <label className="field"><span>Nom du bloc</span><input aria-label="Nom du bloc" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Échauffement piste avec gammes" /></label>
        <label className="check"><input type="checkbox" aria-label="Utilisable dans tous les sports" checked={anySport} onChange={(e) => setAnySport(e.target.checked)} /> <span>Utilisable dans tous les sports (sinon : {SPORT_LABELS[sport].toLowerCase()} seulement)</span></label>
        <div className="actions">
          <button type="button" className="btn small primary" disabled={state === 'saving' || !picked.length || !title.trim()} onClick={async () => {
            setState('saving');
            const chosen = picked.map((i) => blocks[i]!);
            const body = { title: title.trim(), sport: anySport ? null : sport, blocks: chosen };
            const r = await mutate<{ id: string }>('POST', `/api/v1/workspaces/${wid}/block-templates`, body, newKey());
            if (!r.ok) { setState(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.'); return; }
            onSaved({ id: r.data.id, title: body.title, sport: body.sport, blocks: chosen });
            setPicked([]); setTitle(''); setState(chosen.length > 1 ? 'Blocs ajoutés à ta bibliothèque.' : 'Bloc ajouté à ta bibliothèque.');
          }}>{picked.length > 1 ? 'Ajouter les blocs à ma bibliothèque' : 'Ajouter le bloc à ma bibliothèque'}</button>
          {state !== 'idle' && state !== 'saving' ? <span className="muted" role="status">{state}</span> : null}
        </div>
      </div>
    </details>
  );
}

// Constructeur de séance (D-023) : blocs éditables, répétitions et séries, modèles rapides, total en direct.

type EStep = Step & { _k: string };
type ERepeat = { type: 'repeat'; times: number; steps: EBlock[]; _k: string };
export type EBlock = EStep | ERepeat;

let seq = 0;
const key = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Blocs éditables. Avec `stable`, les clés suivent la position (« i0 », « i1.0 ») : identiques au rendu serveur
 * et dans le navigateur (sinon écart d’hydratation). Les blocs ajoutés ensuite reçoivent une clé aléatoire.
 */
export function toEditor(blocks: Block[], stable?: string): EBlock[] {
  return blocks.map((b, i) => {
    const k = stable === undefined ? key() : `${stable}${i}`;
    return b.type === 'step' ? { ...b, _k: k } : { type: 'repeat', times: b.times, steps: toEditor(b.steps, stable === undefined ? undefined : `${k}.`), _k: k };
  });
}
export function fromEditor(blocks: EBlock[]): Block[] {
  return blocks.map((b) => {
    if (b.type === 'repeat') return { type: 'repeat', times: b.times, steps: fromEditor(b.steps) };
    const { _k: _ignored, ...step } = b;
    return step;
  });
}

const newStep = (phase: Phase = 'work', sport: Sport | null = null): EStep => ({
  type: 'step', phase, sport, measure: { kind: 'time', seconds: 600 }, intensity: { kind: 'none' }, cadence: null, note: null, _k: key(),
});
/** D-096 : étape et série de musculation (exercice à choisir, 10 répétitions, repos 1 min 30). */
const newStrengthStep = (phase: Phase = 'work'): EStep => ({ ...newStep(phase), measure: phase === 'work' ? { kind: 'reps', reps: 10 } : { kind: 'time', seconds: 300 } });
const newStrengthRepeat = (): ERepeat => ({
  type: 'repeat', times: 4, _k: key(),
  steps: [newStrengthStep('work'), { ...newStep('rest'), measure: { kind: 'time', seconds: 90 } }],
});

/** D-096 : un exercice écrit en texte se rattache à la bibliothèque quand le nom correspond. */
function linkExercises(blocks: Block[], exercises: ExerciseOption[]): Block[] {
  if (!exercises.length) return blocks;
  const byName = new Map(exercises.map((x) => [x.name.toLowerCase(), x]));
  const fix = (b: Block): Block => {
    if (b.type === 'repeat') return { ...b, steps: b.steps.map(fix) };
    if (!b.exercise || b.exercise.id) return b;
    const hit = byName.get(b.exercise.name.toLowerCase()) ?? byName.get(b.exercise.name.toLowerCase().replace(/s$/, ''));
    return hit ? { ...b, exercise: { id: hit.id, name: hit.name } } : b;
  };
  return blocks.map(fix);
}

const newRepeat = (): ERepeat => ({
  type: 'repeat', times: 5, _k: key(),
  steps: [
    { ...newStep('work'), measure: { kind: 'distance', meters: 400 }, intensity: { kind: 'zone', zone: 6 } },
    { ...newStep('recovery'), measure: { kind: 'distance', meters: 200 }, intensity: { kind: 'zone', zone: 1 } },
  ],
});
const clone = (b: EBlock): EBlock => (b.type === 'step' ? { ...b, _k: key() } : { ...b, _k: key(), steps: b.steps.map(clone) });

const MULTISPORT: Sport[] = ['triathlon', 'duathlon'];
const MULTI_STEP_SPORTS: Record<string, Sport[]> = { triathlon: ['swimming', 'cycling', 'running'], duathlon: ['running', 'cycling'] };
const defaultPaceUnit = (s: Sport) => (s === 'swimming' ? 'per_100m' : 'per_km');

// ---------- Champs ----------

const parseClock = (s: string): number | null => {
  const m = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const clock = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

/** Allure « m:ss » : texte libre, validé à la sortie du champ. */
function PaceInput({ id, value, onChange, label }: { id: string; value: number | null; onChange: (v: number | null) => void; label: string }) {
  const [text, setText] = useState(value === null ? '' : clock(value));
  const [bad, setBad] = useState(false);
  return (
    <input id={id} aria-label={label} inputMode="numeric" placeholder="4:30" size={5} value={text} aria-invalid={bad}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() === '') { setBad(false); return onChange(null); }
        const v = parseClock(text);
        setBad(v === null);
        if (v !== null) onChange(v);
      }} />
  );
}

/** Durée en minutes et secondes : on garde le texte tapé, un champ vidé ne réinjecte pas de seconde parasite. */
function TimeInputs({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
  const [minText, setMinText] = useState(String(Math.floor(seconds / 60)));
  const [secText, setSecText] = useState(String(seconds % 60));
  const commit = (mt: string, st: string) => {
    const total = (Number(mt) || 0) * 60 + Math.min(59, Number(st) || 0);
    if (total > 0) onChange(total);
  };
  return (
    <span className="b-inline">
      <input aria-label="Minutes" type="number" min={0} max={1440} value={minText} className="num"
        onChange={(e) => { setMinText(e.target.value); commit(e.target.value, secText); }}
        onBlur={() => { if (minText.trim() === '' && (Number(secText) || 0) === 0) { setMinText('1'); commit('1', secText); } }} /> min
      <input aria-label="Secondes" type="number" min={0} max={59} step={5} value={secText} className="num"
        onChange={(e) => { setSecText(e.target.value); commit(minText, e.target.value); }}
        onBlur={() => { if (secText.trim() === '') setSecText('0'); }} /> s
    </span>
  );
}

const MEASURE_LABEL: Record<Measure['kind'], string> = { reps: 'Répétitions', time: 'Durée', distance: 'Distance', open: 'Libre' };

function MeasureEditor({ id, m, strength = false, onChange }: { id: string; m: Measure; strength?: boolean; onChange: (m: Measure) => void }) {
  const km = m.kind === 'distance' && m.meters >= 1000 && m.meters % 100 === 0;
  // D-096 : en musculation, répétitions d’abord ; la distance n’a pas de sens.
  const kinds = (strength ? ['reps', 'time', 'open'] : ['time', 'distance', 'open']) as Measure['kind'][];
  return (
    <div className="b-field">
      <div className="seg" role="radiogroup" aria-label="Mesure du bloc">
        {kinds.map((k) => (
          <label key={k}>
            <input type="radio" name={`${id}-measure`} checked={m.kind === k}
              onChange={() => onChange(k === 'time' ? { kind: 'time', seconds: strength ? 30 : 600 } : k === 'distance' ? { kind: 'distance', meters: 1000 } : k === 'reps' ? { kind: 'reps', reps: 10 } : { kind: 'open' })} />
            {MEASURE_LABEL[k]}
          </label>
        ))}
      </div>
      {m.kind === 'reps' ? (
        <span className="b-inline">
          <input aria-label="Nombre de répétitions" type="number" min={1} max={500} value={m.reps} className="num"
            onChange={(e) => onChange({ kind: 'reps', reps: Math.min(500, Math.max(1, Math.round(Number(e.target.value) || 1))) })} /> répétitions
        </span>
      ) : m.kind === 'time' ? (
        <TimeInputs seconds={m.seconds} onChange={(seconds) => onChange({ kind: 'time', seconds })} />
      ) : m.kind === 'distance' ? (
        <span className="b-inline">
          <input aria-label="Distance" type="number" min={1} step={km ? 0.1 : 25} value={km ? m.meters / 1000 : m.meters} className="num"
            onChange={(e) => onChange({ kind: 'distance', meters: Math.max(1, Math.round((Number(e.target.value) || 0) * (km ? 1000 : 1))) })} />
          <select aria-label="Unité de distance" value={km ? 'km' : 'm'}
            onChange={(e) => onChange({ kind: 'distance', meters: e.target.value === 'km' ? Math.max(1000, Math.round(m.meters / 1000) * 1000) : m.meters })}>
            <option value="m">m</option><option value="km">km</option>
          </select>
        </span>
      ) : <span className="muted">{strength ? 'Au maximum, ou jusqu’au repère indiqué en note' : 'À la sensation, jusqu’au repère indiqué en note'}</span>}
    </div>
  );
}

const INTENSITY_KINDS: { k: Intensity['kind']; label: string }[] = [
  { k: 'none', label: 'Sans cible' }, { k: 'zone', label: 'Zone' }, { k: 'pace', label: 'Allure' },
  { k: 'power', label: 'Puissance' }, { k: 'hr', label: 'Fréquence cardiaque' }, { k: 'rpe', label: 'Effort ressenti' },
];
/** D-096 : musculation, sans charge (poids du corps), charge en kg ou effort ressenti. */
const STRENGTH_INTENSITY_KINDS: { k: Intensity['kind']; label: string }[] = [
  { k: 'none', label: 'Poids du corps' }, { k: 'load', label: 'Charge (kg)' }, { k: 'rpe', label: 'Effort ressenti' },
];

function IntensityEditor({ id, i, sport, onChange }: { id: string; i: Intensity; sport: Sport; onChange: (i: Intensity) => void }) {
  const start = (k: Intensity['kind']): Intensity => {
    switch (k) {
      case 'zone': return { kind: 'zone', zone: 2 };
      case 'pace': return { kind: 'pace', unit: defaultPaceUnit(sport), min: sport === 'swimming' ? 110 : 300, max: null };
      case 'power': return { kind: 'power', unit: 'w', min: 200, max: null };
      case 'hr': return { kind: 'hr', unit: 'bpm', min: 140, max: null };
      case 'rpe': return { kind: 'rpe', min: 5, max: null };
      case 'load': return { kind: 'load', min: 10, max: null };
      default: return { kind: 'none' };
    }
  };
  const num = (label: string, v: number | null, set: (n: number | null) => void, min: number, max: number) => (
    <input aria-label={label} type="number" className="num" min={min} max={max} value={v ?? ''} placeholder={v === null ? '—' : undefined}
      onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />
  );
  return (
    <div className="b-field">
      <label className="b-label" htmlFor={`${id}-ik`}>Intensité</label>
      <span className="b-inline">
        <select id={`${id}-ik`} value={i.kind} onChange={(e) => onChange(start(e.target.value as Intensity['kind']))}>
          {(sport === 'strength' ? STRENGTH_INTENSITY_KINDS : INTENSITY_KINDS).map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
        </select>
        {i.kind === 'load' ? (
          <>
            <input aria-label="Charge en kg" type="number" className="num" min={0.5} max={500} step={0.5} value={i.min}
              onChange={(e) => onChange({ ...i, min: Math.max(0.5, Math.round((Number(e.target.value) || 0.5) * 2) / 2) })} /> kg
          </>
        ) : null}
        {i.kind === 'zone' ? (
          <span className="seg zones" role="radiogroup" aria-label="Zone">
            {ZONES.map((z) => (
              <label key={z} title={`Z${z} · ${ZONE_NAMES[z]}`} className={`z${z}`}><input type="radio" name={`${id}-zone`} checked={i.zone === z} onChange={() => onChange({ kind: 'zone', zone: z })} />Z{z}</label>
            ))}
          </span>
        ) : null}
        {i.kind === 'pace' ? (
          <>
            <PaceInput id={`${id}-pmin`} label="Allure la plus lente" value={i.min} onChange={(v) => v !== null && onChange({ ...i, min: v })} />
            à
            <PaceInput id={`${id}-pmax`} label="Allure la plus rapide (facultatif)" value={i.max} onChange={(v) => onChange({ ...i, max: v })} />
            <select aria-label="Unité d’allure" value={i.unit} onChange={(e) => onChange({ ...i, unit: e.target.value as 'per_km' | 'per_100m' })}>
              <option value="per_km">/km</option><option value="per_100m">/100 m</option>
            </select>
          </>
        ) : null}
        {i.kind === 'power' ? (
          <>
            {num('Puissance basse', i.min, (n) => onChange({ ...i, min: n ?? 1 }), 1, 2500)} à {num('Puissance haute (facultatif)', i.max, (n) => onChange({ ...i, max: n }), 1, 2500)}
            <select aria-label="Unité de puissance" value={i.unit} onChange={(e) => onChange({ ...i, unit: e.target.value as 'w' | 'pct_ftp' })}>
              <option value="w">W</option><option value="pct_ftp">% FTP</option>
            </select>
          </>
        ) : null}
        {i.kind === 'hr' ? (
          <>
            {num('Fréquence basse', i.min, (n) => onChange({ ...i, min: n ?? 30 }), 30, 250)} à {num('Fréquence haute (facultatif)', i.max, (n) => onChange({ ...i, max: n }), 30, 250)}
            <select aria-label="Unité de fréquence cardiaque" value={i.unit} onChange={(e) => onChange({ ...i, unit: e.target.value as 'bpm' | 'pct_max' })}>
              <option value="bpm">bpm</option><option value="pct_max">% FC max</option>
            </select>
          </>
        ) : null}
        {i.kind === 'rpe' ? (
          <>{num('Effort bas', i.min, (n) => onChange({ ...i, min: n ?? 1 }), 1, 10)} à {num('Effort haut (facultatif)', i.max, (n) => onChange({ ...i, max: n }), 1, 10)} /10</>
        ) : null}
      </span>
    </div>
  );
}

// ---------- Déplacement (glisser-déposer, clavier, menu) ----------

interface DnD {
  dragging: string | null;
  start: (key: string, e: ReactPointerEvent<HTMLElement>, label: string) => void;
  onHandleKey: (key: string, e: ReactKeyboardEvent<HTMLElement>) => void;
  shift: (key: string, d: -1 | 1) => void;
  lift: (key: string) => void;
}

/** Poignée : glisser à la souris ou au doigt ; flèches haut et bas au clavier. */
function Handle({ k, index, label, dnd }: { k: string; index: string; label: string; dnd: DnD }) {
  return (
    <button type="button" className="b-handle" data-handle={k}
      aria-label={`Déplacer le bloc ${index} : glisser, ou flèches haut et bas`}
      title="Glisser pour déplacer"
      onPointerDown={(e) => dnd.start(k, e, label)}
      onKeyDown={(e) => dnd.onHandleKey(k, e)}>
      <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
        {[3, 10, 17].map((y) => [4, 10].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="currentColor" />))}
      </svg>
    </button>
  );
}

/** Outils d’un bloc : dupliquer, supprimer, et un menu « Plus » (monter, descendre, sortir de la répétition). */
function Tools({ k, index, inside, dnd, onDuplicate, onRemove }: { k: string; index: string; inside: boolean; dnd: DnD; onDuplicate: () => void; onRemove: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute('open');
  return (
    <span className="b-tools">
      <button type="button" className="icon-btn" onClick={onDuplicate} aria-label={`Dupliquer le bloc ${index}`} title="Dupliquer">⧉</button>
      <button type="button" className="icon-btn danger" onClick={onRemove} aria-label={`Supprimer le bloc ${index}`} title="Supprimer">✕</button>
      <details className="b-more" ref={ref}>
        <summary className="icon-btn" aria-label={`Plus d’actions pour le bloc ${index}`} title="Plus">⋯</summary>
        <div className="b-menu">
          <button type="button" onClick={() => { dnd.shift(k, -1); close(); }}>Monter</button>
          <button type="button" onClick={() => { dnd.shift(k, 1); close(); }}>Descendre</button>
          {inside ? <button type="button" onClick={() => { dnd.lift(k); close(); }}>Sortir de la répétition</button> : null}
        </div>
      </details>
    </span>
  );
}

// ---------- Étape et répétition ----------

function StepEditor({ step, sport, index, refs, onChange, head, tools }: { step: EStep; sport: Sport; index: string; refs?: References; onChange: (s: EStep) => void; head: React.ReactNode; tools: React.ReactNode }) {
  const id = useId();
  const [noteOpen, setNoteOpen] = useState(Boolean(step.note));
  const stepSport = step.sport ?? (MULTISPORT.includes(sport) ? null : sport);
  const zone = step.intensity.kind === 'zone' ? step.intensity.zone : null;
  const { _k: _ignored, ...plain } = step;
  const est = stepEstimate(plain, sport, refs);
  const strength = stepSport === 'strength' || sport === 'strength';
  const exercises = useContext(ExercisesCtx);
  const hint = [
    zone ? `Z${zone} · ${ZONE_NAMES[zone as Zone]}` : null,
    zone ? personalTarget(plain, sport, refs) : null,
    est.meters ? `environ ${formatKm(est.meters)}` : null,
    est.seconds ? `environ ${formatClock(est.seconds)}` : null,
  ].filter(Boolean);
  return (
    <div className={`b-step phase-${step.phase}${zone ? ` z${zone}` : ''}`} role="group" aria-label={`Bloc ${index}`}>
      <div className="b-head">
        {head}
        <select className="b-phase" aria-label={`Type du bloc ${index}`} value={step.phase} onChange={(e) => onChange({ ...step, phase: e.target.value as Phase })}>
          {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
        </select>
        {MULTISPORT.includes(sport) ? (
          <select aria-label={`Sport du bloc ${index}`} value={step.sport ?? ''} onChange={(e) => onChange({ ...step, sport: (e.target.value || null) as Sport | null })}>
            <option value="">Sport…</option>
            {(MULTI_STEP_SPORTS[sport] ?? SPORTS).map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
          </select>
        ) : null}
        <span className="b-spacer" />
        {tools}
      </div>
      <div className="b-body">
        {strength && step.phase !== 'rest' && step.phase !== 'recovery' ? (
          <div className="b-field">
            <label className="b-label" htmlFor={`${id}-ex`}>Exercice</label>
            <input id={`${id}-ex`} list={`${id}-exl`} maxLength={80} value={step.exercise?.name ?? ''} placeholder={exercises.length ? 'Choisis ou écris un exercice' : 'Ex. Squat goblet'}
              onChange={(e) => {
                const name = e.target.value;
                const hit = exercises.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
                onChange({ ...step, exercise: name.trim() ? { id: hit?.id ?? null, name: hit?.name ?? name } : null });
              }} />
            <datalist id={`${id}-exl`}>{exercises.map((x) => <option key={x.id} value={x.name} />)}</datalist>
            {step.exercise && !step.exercise.id && exercises.length ? <span className="b-hint">Pas dans ta bibliothèque : l’élève verra le nom, sans vidéo.</span> : null}
          </div>
        ) : null}
        <MeasureEditor id={id} m={step.measure} strength={strength} onChange={(m) => onChange({ ...step, measure: m })} />
        <IntensityEditor id={id} i={step.intensity} sport={strength ? 'strength' : (stepSport ?? 'running')} onChange={(i) => onChange({ ...step, intensity: i })} />
        {hint.length ? <p className="b-hint">{hint.join(' · ')}</p> : null}
        {noteOpen ? (
          <div className="b-field">
            <label className="b-label" htmlFor={`${id}-note`}>Note</label>
            <input id={`${id}-note`} maxLength={200} value={step.note ?? ''} placeholder="Par exemple : en côte, pieds rapides, pull-buoy"
              onChange={(e) => onChange({ ...step, note: e.target.value || null })} />
          </div>
        ) : (
          <button type="button" className="link-btn b-note-add" onClick={() => setNoteOpen(true)}>+ Ajouter une note</button>
        )}
      </div>
    </div>
  );
}

function BlockList({ blocks, sport, depth, prefix, parent, refs, dnd, onChange }: {
  blocks: EBlock[]; sport: Sport; depth: number; prefix: string; parent: string | null; refs?: References; dnd: DnD; onChange: (b: EBlock[]) => void;
}) {
  const update = (k: number, b: EBlock) => onChange(blocks.map((x, i) => (i === k ? b : x)));
  return (
    <ol className={`b-list depth-${depth}`} data-parent={parent ?? ''}>
      {blocks.map((b, k) => {
        const index = prefix ? `${prefix}.${k + 1}` : String(k + 1);
        const label = describeBlock(fromEditor([b])[0]!, sport);
        const head = (
          <>
            <Handle k={b._k} index={index} label={label} dnd={dnd} />
            <span className="b-index" aria-hidden="true">{index}</span>
          </>
        );
        const tools = (
          <Tools k={b._k} index={index} inside={parent !== null} dnd={dnd}
            onDuplicate={() => onChange([...blocks.slice(0, k + 1), clone(b), ...blocks.slice(k + 1)])}
            onRemove={() => onChange(blocks.filter((_, i) => i !== k))} />
        );
        return (
          <li key={b._k} data-bk={b._k} data-kind={b.type} className={dnd.dragging === b._k ? 'is-dragging' : undefined}>
            {b.type === 'step' ? (
              <StepEditor step={b} sport={sport} index={index} refs={refs} onChange={(s) => update(k, s)} head={head} tools={tools} />
            ) : (
              <div className={`b-repeat depth-${depth}`} role="group" aria-label={`Répétition ${index}`}>
                <div className="b-head b-repeat-head">
                  {head}
                  <span className="b-repeat-icon" aria-hidden="true">↻</span>
                  <label className="b-inline b-times">Répéter
                    <input type="number" className="num" min={2} max={50} value={b.times} aria-label={`Nombre de répétitions du bloc ${index}`}
                      onChange={(e) => update(k, { ...b, times: Math.min(50, Math.max(2, Number(e.target.value) || 2)) })} /> fois
                  </label>
                  <span className="b-spacer" />
                  {tools}
                </div>
                <BlockList blocks={b.steps} sport={sport} depth={depth + 1} prefix={index} parent={b._k} refs={refs} dnd={dnd} onChange={(steps) => update(k, { ...b, steps })} />
                <div className="actions b-repeat-foot">
                  <button type="button" className="btn small" onClick={() => update(k, { ...b, steps: [...b.steps, newStep('recovery')] })}>+ Étape dans la répétition</button>
                  {depth === 0 ? <button type="button" className="btn small" onClick={() => update(k, { ...b, steps: [...b.steps, newRepeat()] })}>+ Série imbriquée</button> : null}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Constructeur ----------

type Indicator = { top: number; left: number; width: number };

/** Constructeur complet, contrôlé par le formulaire de séance. */
export function WorkoutBuilder({ sport, value, onChange, refs, athleteFirst, vmaHref, library, exercises = [] }: {
  sport: Sport; value: EBlock[]; onChange: (b: EBlock[]) => void; refs?: References; athleteFirst?: string; vmaHref?: string;
  /** D-074 : blocs réutilisables du coach (insérer, garder). Absent : seulement les modèles rapides. */
  library?: { wid: string; blocks: SavedBlock[] };
  /** D-096 : exercices de la bibliothèque, proposés dans les blocs de musculation. */
  exercises?: ExerciseOption[];
}) {
  const presets = presetsFor(sport);
  const [mine, setMine] = useState<SavedBlock[]>(library?.blocks ?? []);
  const usable = mine.filter((b) => !b.sport || b.sport === sport);
  const blocks = fromEditor(value);
  const totals = structureTotals(blocks, { sport, refs });
  const defaultSport = MULTISPORT.includes(sport) ? (MULTI_STEP_SPORTS[sport]?.[0] ?? null) : null;
  const root = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState<{ key: string; label: string; x: number; y: number; active: boolean } | null>(null);
  const [drop, setDrop] = useState<(DropTarget & Indicator) | null>(null);
  const [announce, setAnnounce] = useState('');
  const focusKey = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const dropRef = useRef(drop);
  dropRef.current = drop;

  // Après un déplacement au clavier, la poignée garde le focus.
  useEffect(() => {
    if (!focusKey.current) return;
    root.current?.querySelector<HTMLElement>(`[data-handle="${focusKey.current}"]`)?.focus();
    focusKey.current = null;
  }, [value]);

  const position = (key: string, next: EBlock[]) => {
    const f = find(next, key);
    return f ? `position ${f.index + 1} sur ${f.list.length}${f.parent ? ' dans la répétition' : ''}` : '';
  };
  const apply = (key: string, next: EBlock[], how: string) => {
    if (next === valueRef.current) { setAnnounce('Déplacement impossible ici.'); return; }
    focusKey.current = how === 'clavier' ? key : null;
    onChange(next);
    setAnnounce(`Bloc déplacé : ${position(key, next)}.`);
  };

  /** Cible sous le pointeur : avant ou après une étape, en tête ou en fin de répétition. */
  const targetAt = (x: number, y: number, key: string): (DropTarget & Indicator) | null => {
    const el = document.elementFromPoint(x, y);
    if (!el || !root.current?.contains(el)) return null;
    const li = el.closest<HTMLElement>('li[data-bk]');
    if (!li) {
      // Sous la liste : fin de séance.
      const list = root.current.querySelector<HTMLElement>('.b-list.depth-0');
      if (!list) return null;
      const r = list.getBoundingClientRect();
      return y > r.bottom - 4 ? { parent: null, before: null, top: r.bottom + 2, left: r.left, width: r.width } : null;
    }
    const k = li.dataset.bk!;
    if (k === key || li.closest(`li[data-bk="${key}"]`)) return null;
    const parentList = li.parentElement as HTMLElement;
    const parent = parentList.dataset.parent || null;
    const r = li.getBoundingClientRect();
    const lr = parentList.getBoundingClientRect();
    if (li.dataset.kind === 'repeat') {
      const head = li.querySelector<HTMLElement>(':scope > .b-repeat > .b-repeat-head')!.getBoundingClientRect();
      const inner = li.querySelector<HTMLElement>(':scope > .b-repeat > .b-list')!;
      const ir = inner.getBoundingClientRect();
      if (y < head.top + head.height / 2) return { parent, before: k, top: r.top - 6, left: lr.left, width: lr.width };
      if (y <= head.bottom + 4) {
        const first = inner.firstElementChild as HTMLElement | null;
        return { parent: k, before: first?.dataset.bk ?? null, top: ir.top - 4, left: ir.left, width: ir.width };
      }
      if (el.closest('.b-repeat-foot') && el.closest('li[data-bk]') === li) return { parent: k, before: null, top: ir.bottom + 3, left: ir.left, width: ir.width };
      if (y > r.bottom - 10) {
        const next = li.nextElementSibling as HTMLElement | null;
        return { parent, before: next?.dataset.bk ?? null, top: r.bottom + 5, left: lr.left, width: lr.width };
      }
      return null;
    }
    if (y < r.top + r.height / 2) return { parent, before: k, top: r.top - 6, left: lr.left, width: lr.width };
    const next = li.nextElementSibling as HTMLElement | null;
    return { parent, before: next?.dataset.bk ?? null, top: r.bottom + 5, left: lr.left, width: lr.width };
  };

  const dnd: DnD = {
    dragging: drag?.active ? drag.key : null,
    start: (key, e, label) => {
      if (e.button !== 0) return;
      e.preventDefault();
      setDrag({ key, label, x: e.clientX, y: e.clientY, active: false });
    },
    onHandleKey: (key, e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      apply(key, shift(valueRef.current, key, e.key === 'ArrowUp' ? -1 : 1), 'clavier');
    },
    shift: (key, d) => apply(key, shift(valueRef.current, key, d), 'menu'),
    lift: (key) => apply(key, lift(valueRef.current, key), 'menu'),
  };

  // Suivi du pointeur pendant le glissement, défilement automatique près des bords.
  useEffect(() => {
    if (!drag) return;
    const sx = drag.x, sy = drag.y;
    let last = { x: sx, y: sy };
    let active = drag.active;
    const move = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY };
      if (!active && Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
      active = true;
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, active: true } : d));
      const t = targetAt(e.clientX, e.clientY, drag.key);
      if (t) setDrop(canDrop(valueRef.current, drag.key, t) ? t : null);
    };
    const end = () => {
      const t = dropRef.current;
      if (active && t) apply(drag.key, moveBlock(valueRef.current, drag.key, t), 'souris');
      setDrag(null);
      setDrop(null);
    };
    const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') { active = false; setDrag(null); setDrop(null); } };
    const scroll = setInterval(() => {
      if (!active) return;
      if (last.y < 70) window.scrollBy(0, -12);
      else if (last.y > window.innerHeight - 70) window.scrollBy(0, 12);
    }, 16);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
    window.addEventListener('keydown', cancel);
    return () => {
      clearInterval(scroll);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('keydown', cancel);
    };
    // Un seul abonnement par glissement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.key]);

  const runSport = usesVma(sport) || MULTISPORT.includes(sport);
  const strength = sport === 'strength';
  return (
    <ExercisesCtx.Provider value={exercises}>
    <section className={`builder${drag?.active ? ' is-sorting' : ''}`} aria-labelledby="builder-title" data-tour="builder" ref={root}>
      <div className="b-title-row">
        <h2 id="builder-title">Déroulé de la séance</h2>
        <p className="muted">{strength
          ? 'Choisis tes exercices, leurs répétitions, la charge et le repos ; « + Série » répète un exercice (4 × 10). Glisse un bloc par sa poignée pour le déplacer.'
          : 'Construis la séance bloc par bloc : durée ou distance, zone, répétitions et séries. Glisse un bloc par sa poignée pour le déplacer.'}</p>
      </div>
      {value.length ? (
        <BlockList blocks={value} sport={sport} depth={0} prefix="" parent={null} refs={refs} dnd={dnd} onChange={onChange} />
      ) : (
        <p className="empty b-empty">Aucun bloc pour l’instant. Ajoute une étape, une répétition ou pars d’un modèle.</p>
      )}
      <div className="actions" data-tour="builder-add">
        {strength ? (
          <>
            <button type="button" className="btn" onClick={() => onChange([...value, newStrengthStep('work')])}>+ Exercice</button>
            <button type="button" className="btn" onClick={() => onChange([...value, newStrengthRepeat()])}>+ Série</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => onChange([...value, newStep(value.length ? 'work' : 'warmup', defaultSport)])}>+ Étape</button>
            <button type="button" className="btn" onClick={() => onChange([...value, newRepeat()])}>+ Répétition</button>
          </>
        )}
        <label className="visually-hidden" htmlFor="preset">Ajouter un modèle</label>
        <select id="preset" className="select" value="" data-tour="presets"
          onChange={(e) => {
            const p = presets.find((x) => x.id === e.target.value);
            if (p) onChange([...value, ...toEditor(p.blocks())]);
          }}>
          <option value="">+ Modèle rapide…</option>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {library ? (
          <>
            <label className="visually-hidden" htmlFor="my-block">Ajouter un de mes blocs</label>
            <select id="my-block" className="select" value="" disabled={!usable.length}
              onChange={(e) => { const b = usable.find((x) => x.id === e.target.value); if (b) onChange([...value, ...toEditor(b.blocks)]); }}>
              <option value="">{usable.length ? '+ Mon bloc…' : 'Aucun bloc gardé'}</option>
              {usable.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </>
        ) : null}
      </div>
      {library ? <KeepBlocks wid={library.wid} sport={sport} blocks={blocks} onSaved={(b) => setMine((m) => [...m, b].sort((x, y) => x.title.localeCompare(y.title, 'fr')))} /> : null}
      <QuickNotation sport={sport} blocks={blocks} refs={refs}
        onApply={(raw, mode) => { const bs = linkExercises(raw, exercises); onChange(mode === 'replace' ? toEditor(bs) : [...value, ...toEditor(bs)]); }} />
      {value.length ? (
        <div className="b-summary" aria-live="polite">
          <p className="b-total"><strong>Total :</strong> {describeTotals(totals)}</p>
          <SessionChart bars={sessionProfile(blocks, sport, refs)} />
          {runSport && !refs?.vmaKmh ? (
            <p className="muted">Sans VMA, les kilomètres ne sont estimés que pour les blocs avec une allure.
              {vmaHref ? <> <a href={vmaHref}>Renseigner la VMA{athleteFirst ? ` de ${athleteFirst}` : ''}</a></> : null}</p>
          ) : null}
          {(usesFtp(sport) && !refs?.ftpW) || (usesCss(sport) && !refs?.cssSecPer100) ? (
            <p className="muted">{usesFtp(sport) ? 'Sans FTP, les zones ne sont pas traduites en watts.' : 'Sans CSS, les zones ne sont pas traduites en allures de nage.'}
              {vmaHref ? <> <a href={vmaHref}>Renseigner {usesFtp(sport) ? 'la FTP' : 'la CSS'}{athleteFirst ? ` de ${athleteFirst}` : ''}</a></> : null}</p>
          ) : null}
          {totals.unknownTime ? <p className="muted">Une partie du temps dépend de l’athlète (bloc libre ou distance sans allure).</p> : null}
          <p className="muted" style={{ marginTop: 6 }}>Ce que lira l’athlète :</p>
          <ol className="b-preview">{blocks.map((b, k) => <li key={k}>{describeBlock(b, sport)}</li>)}</ol>
        </div>
      ) : null}
      <p className="visually-hidden" aria-live="assertive">{announce}</p>
      {drag?.active ? <div className="b-ghost" style={{ left: drag.x + 12, top: drag.y + 12 }} aria-hidden="true">{drag.label}</div> : null}
      {drag?.active && drop ? <div className="b-drop" style={{ top: drop.top, left: drop.left, width: drop.width }} aria-hidden="true" /> : null}
    </section>
    </ExercisesCtx.Provider>
  );
}
