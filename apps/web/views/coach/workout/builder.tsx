'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  describeBlock, describeTotals, formatClock, formatKm, formatPace, PHASES, PHASE_LABELS, presetsFor, SPORTS, SPORT_LABELS, stepEstimate,
  personalTarget, sessionView, structureTotals, usesCss, usesFtp, usesVma, ZONE_NAMES, ZONES,
  type Block, type Intensity, type Measure, type Phase, type References, type Sport, type Step, type Zone, exerciseFits, missingEquipment, type AthleteGear, type ExerciseEquipment, exerciseKey, formatShortDate, type LastDone,
  CADENCE_UNIT, MACHINE_DEFAULT_SETTINGS, MACHINE_LABELS, MACHINE_SETTINGS, MACHINES, STAGE_SETTING_LABELS, stageProfile, stagesSeconds,
  type Cardio, type Machine, type Stage, type StageSetting, fitSetsToTimes, type SetPlan,
} from '@coachos/domain';
import { canDrop, find, lift, moveBlock, shift, type DropTarget } from '@/components/block-tree';
import { mutate, newKey } from '@/components/api-client';
import { Button, Checkbox, Cluster, Field, Icon, IconButton, Input, MenuItem, Popover, Select, SessionStrip, Stack, Text } from '@/design';
import { cx } from '@/design/cx';
import { QuickNotation } from './quick-notation';
import { AiDictation } from './ai-dictation';
import { MachinePicker, readGym, type Gym, type PickedExercise } from './machine-picker';
import s from './builder.module.css';

/** D-096 : exercices de la bibliothèque du coach, proposés dans les blocs de musculation. */
export interface ExerciseOption { id: string; name: string; equipment?: ExerciseEquipment[] }
const ExercisesCtx = createContext<ExerciseOption[]>([]);
/** D-181 : ouvrir le choix d’une machine pour une étape (absent hors d’un espace : bibliothèque de démonstration…). */
const PickOneCtx = createContext<((onPick: (x: PickedExercise) => void) => void) | null>(null);
/** D-111 : matériel de l’élève de la séance (absent pour la bibliothèque et les groupes). */
export interface AthleteGearInfo { first: string; gear: AthleteGear }
const GearCtx = createContext<AthleteGearInfo | null>(null);
/** D-112 : ce que l’élève a fait la dernière fois, par exercice. */
const LastCtx = createContext<Record<string, LastDone>>({});
/** D-186 · Cartes réduites à une ligne : l’exercice écrit se replie pour se concentrer sur la suite. */
const FoldCtx = createContext<{ folded: ReadonlySet<string>; toggle: (k: string) => void }>({ folded: new Set(), toggle: () => undefined });

/** Bloc réutilisable de la bibliothèque du coach (D-074). */
export interface SavedBlock { id: string; title: string; sport: Sport | null; blocks: Block[] }

/** D-074 : ajouter une partie de la séance à la bibliothèque comme bloc réutilisable (échauffement type, série type…). D-094 : « ajouter », pas « garder ». */
function KeepBlocks({ wid, sport, blocks, onSaved }: { wid: string; sport: Sport; blocks: Block[]; onSaved: (b: SavedBlock) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [anySport, setAnySport] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | string>('idle');
  const uid = useId();
  if (!blocks.length) return null;
  return (
    <details className={s.keep}>
      <summary className={s.keepSummary}><Icon name="download" size={16} />Ajouter des blocs à ma bibliothèque</summary>
      <Stack gap={3} className={s.keepBody}>
        <fieldset className={s.fieldset}><legend className={s.label}>Blocs à ajouter</legend>
          {blocks.map((b, i) => (
            <Checkbox key={i} label={describeBlock(b, sport)} checked={picked.includes(i)} onChange={() => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort((a, z) => a - z)))} />
          ))}
        </fieldset>
        <Field id={`${uid}-name`} label="Nom du bloc"><Input id={`${uid}-name`} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Échauffement piste avec gammes" /></Field>
        <Checkbox checked={anySport} onChange={setAnySport} label={`Utilisable dans tous les sports (sinon : ${SPORT_LABELS[sport].toLowerCase()} seulement)`} />
        <Cluster gap={2}>
          <Button size="sm" variant="primary" loading={state === 'saving'} disabled={!picked.length || !title.trim()} onClick={async () => {
            setState('saving');
            const chosen = picked.map((i) => blocks[i]!);
            const body = { title: title.trim(), sport: anySport ? null : sport, blocks: chosen };
            const r = await mutate<{ id: string }>('POST', `/api/v1/workspaces/${wid}/block-templates`, body, newKey());
            if (!r.ok) { setState(r.kind === 'error' ? (r.fields[0]?.rule ?? r.message) : 'Connexion perdue. Réessaie.'); return; }
            onSaved({ id: r.data.id, title: body.title, sport: body.sport, blocks: chosen });
            setPicked([]); setTitle(''); setState(chosen.length > 1 ? 'Blocs ajoutés à ta bibliothèque.' : 'Bloc ajouté à ta bibliothèque.');
          }}>{picked.length > 1 ? 'Ajouter les blocs à ma bibliothèque' : 'Ajouter le bloc à ma bibliothèque'}</Button>
          {state !== 'idle' && state !== 'saving' ? <Text as="span" size="sm" muted role="status">{state}</Text> : null}
        </Cluster>
      </Stack>
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
  type: 'repeat', times: 3, _k: key(),
  steps: [newStrengthStep('work'), { ...newStep('rest'), measure: { kind: 'time', seconds: 90 } }],
});
/** D-181 : un exercice choisi parmi les machines devient 3 séries de 10, repos 1 min 30. */
const withExercise = (x: PickedExercise): ERepeat => {
  const r = newStrengthRepeat();
  return { ...r, steps: r.steps.map((st, k) => (k === 0 && st.type === 'step' ? { ...st, exercise: { id: x.id, name: x.name } } : st)) };
};
/** Noms (en minuscules) des exercices déjà dans la séance. */
function exerciseNames(blocks: Block[]): string[] {
  return blocks.flatMap((b) => (b.type === 'repeat' ? exerciseNames(b.steps) : b.exercise ? [b.exercise.name.toLowerCase()] : []));
}
/** D-165 : circuit, deux exercices enchaînés puis une récupération, en 3 tours. */
const newCircuit = (): ERepeat => ({
  type: 'repeat', times: 3, _k: key(),
  steps: [newStrengthStep('work'), newStrengthStep('work'), { ...newStep('rest'), measure: { kind: 'time', seconds: 90 } }],
});

/** D-164 : cardio sur machine en paliers ; d’office un palier de 10 minutes sur vélo elliptique. */
const blankStage = (seconds: number, from?: Stage): Stage => ({
  seconds, level: null, speedKmh: null, inclinePct: null, cadence: null, watts: null, split500: null, rpe: null, note: null, ...(from ? { ...from, seconds } : {}),
});
const newCardioStep = (phase: Phase, machine: Machine = 'elliptical'): EStep => ({
  ...newStep(phase), cardio: { machine, stages: [blankStage(600)] }, measure: { kind: 'time', seconds: 600 },
});
/** Machine devinée d’après le nom d’un exercice déjà écrit (« Marche rapide » → tapis). */
function guessMachine(name: string | undefined): Machine {
  const n = (name ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/tapis|marche|treadmill|course|footing/.test(n)) return 'treadmill';
  if (/ellip/.test(n)) return 'elliptical';
  if (/velo|bike|spinning|cycl/.test(n)) return 'bike';
  if (/rame|rower|aviron/.test(n)) return 'rower';
  if (/escalier|stepper|stair|marches/.test(n)) return 'stairs';
  if (/ski/.test(n)) return 'skierg';
  return 'other';
}
const withCardio = (step: EStep, c: Cardio): EStep => ({ ...step, cardio: c, measure: { kind: 'time', seconds: stagesSeconds(c) }, intensity: { kind: 'none' } });

/** D-102 : renforcement ajouté à une séance d’endurance (séance mixte) : 3 séries d’un exercice, étapes en musculation. */
const newMixedStrength = (): ERepeat => ({
  type: 'repeat', times: 3, _k: key(),
  steps: [{ ...newStrengthStep('work'), sport: 'strength' }, { ...newStep('rest', 'strength'), measure: { kind: 'time', seconds: 60 } }],
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
    <input id={id} className={cx(s.control, s.pace)} aria-label={label} inputMode="numeric" placeholder="4:30" size={5} value={text} aria-invalid={bad}
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
function TimeInputs({ seconds, onChange, label, compact = false, allowZero = false }: { seconds: number; onChange: (s: number) => void; label?: string; compact?: boolean; allowZero?: boolean }) {
  const [minText, setMinText] = useState(String(Math.floor(seconds / 60)));
  const [secText, setSecText] = useState(String(seconds % 60));
  const commit = (mt: string, st: string) => {
    const total = (Number(mt) || 0) * 60 + Math.min(59, Number(st) || 0);
    if (total > 0 || allowZero) onChange(total);
  };
  return (
    <span className={s.inline}>
      <input aria-label={label ? `Minutes ${label}` : 'Minutes'} type="number" min={0} max={1440} value={minText} className={cx(s.control, compact ? s.numCompact : s.num)}
        onChange={(e) => { setMinText(e.target.value); commit(e.target.value, secText); }}
        onBlur={() => {
          if (minText.trim() !== '') return;
          if (allowZero) { setMinText('0'); return; }
          if ((Number(secText) || 0) === 0) { setMinText('1'); commit('1', secText); }
        }} /> min
      <input aria-label={label ? `Secondes ${label}` : 'Secondes'} type="number" min={0} max={59} step={5} value={secText} className={cx(s.control, compact ? s.numCompact : s.num)}
        onChange={(e) => { setSecText(e.target.value); commit(minText, e.target.value); }}
        onBlur={() => { if (secText.trim() === '') setSecText('0'); }} /> s
    </span>
  );
}

const MEASURE_LABEL: Record<Measure['kind'], string> = { reps: 'Répétitions', time: 'Durée', distance: 'Distance', open: 'Libre' };

function MeasureEditor({ id, m, strength = false, hideValue = false, onChange }: { id: string; m: Measure; strength?: boolean; hideValue?: boolean; onChange: (m: Measure) => void }) {
  const km = m.kind === 'distance' && m.meters >= 1000 && m.meters % 100 === 0;
  // D-096 : en musculation, répétitions d’abord ; la distance n’a pas de sens.
  const kinds = (strength ? ['reps', 'time', 'open'] : ['time', 'distance', 'open']) as Measure['kind'][];
  return (
    <div className={s.field}>
      <div className={s.seg} role="radiogroup" aria-label="Mesure du bloc">
        {kinds.map((k) => (
          <label key={k} className={s.segItem}>
            <input type="radio" name={`${id}-measure`} checked={m.kind === k}
              onChange={() => onChange(k === 'time' ? { kind: 'time', seconds: strength ? 30 : 600 } : k === 'distance' ? { kind: 'distance', meters: 1000 } : k === 'reps' ? { kind: 'reps', reps: 10 } : { kind: 'open' })} />
            {MEASURE_LABEL[k]}
          </label>
        ))}
      </div>
      {m.kind === 'reps' && hideValue ? null : m.kind === 'reps' ? (
        <span className={s.inline}>
          <input aria-label="Nombre de répétitions" type="number" min={1} max={500} value={m.reps} className={cx(s.control, s.num)}
            onChange={(e) => onChange({ kind: 'reps', reps: Math.min(500, Math.max(1, Math.round(Number(e.target.value) || 1))) })} /> répétitions
        </span>
      ) : m.kind === 'time' ? (
        <TimeInputs seconds={m.seconds} onChange={(seconds) => onChange({ kind: 'time', seconds })} />
      ) : m.kind === 'distance' ? (
        <span className={s.inline}>
          <input aria-label="Distance" type="number" min={1} step={km ? 0.1 : 25} value={km ? m.meters / 1000 : m.meters} className={cx(s.control, s.num)}
            onChange={(e) => onChange({ kind: 'distance', meters: Math.max(1, Math.round((Number(e.target.value) || 0) * (km ? 1000 : 1))) })} />
          <select className={s.control} aria-label="Unité de distance" value={km ? 'km' : 'm'}
            onChange={(e) => onChange({ kind: 'distance', meters: e.target.value === 'km' ? Math.max(1000, Math.round(m.meters / 1000) * 1000) : m.meters })}>
            <option value="m">m</option><option value="km">km</option>
          </select>
        </span>
      ) : <span className={s.muted}>{strength ? 'Au maximum, ou jusqu’au repère indiqué en note' : 'À la sensation, jusqu’au repère indiqué en note'}</span>}
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

function IntensityEditor({ id, i, sport, hideValue = false, onChange }: { id: string; i: Intensity; sport: Sport; hideValue?: boolean; onChange: (i: Intensity) => void }) {
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
    <input aria-label={label} type="number" className={cx(s.control, s.num)} min={min} max={max} value={v ?? ''} placeholder={v === null ? '—' : undefined}
      onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />
  );
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={`${id}-ik`}>Intensité</label>
      <span className={s.inline}>
        <select id={`${id}-ik`} className={s.control} value={i.kind} onChange={(e) => onChange(start(e.target.value as Intensity['kind']))}>
          {(sport === 'strength' ? STRENGTH_INTENSITY_KINDS : INTENSITY_KINDS).map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
        </select>
        {i.kind === 'load' && !hideValue ? (
          <>
            <input aria-label="Charge en kg" type="number" className={cx(s.control, s.num)} min={0.5} max={500} step={0.5} value={i.min}
              onChange={(e) => onChange({ ...i, min: Math.max(0.5, Math.round((Number(e.target.value) || 0.5) * 2) / 2) })} /> kg
          </>
        ) : null}
        {i.kind === 'zone' ? (
          <span className={cx(s.seg, s.zones)} role="radiogroup" aria-label="Zone">
            {ZONES.map((z) => (
              <label key={z} title={`Z${z} · ${ZONE_NAMES[z]}`} className={s.segItem} data-zone={z}><input type="radio" name={`${id}-zone`} checked={i.zone === z} onChange={() => onChange({ kind: 'zone', zone: z })} />Z{z}</label>
            ))}
          </span>
        ) : null}
        {i.kind === 'pace' ? (
          <>
            <PaceInput id={`${id}-pmin`} label="Allure la plus lente" value={i.min} onChange={(v) => v !== null && onChange({ ...i, min: v })} />
            à
            <PaceInput id={`${id}-pmax`} label="Allure la plus rapide (facultatif)" value={i.max} onChange={(v) => onChange({ ...i, max: v })} />
            <select className={s.control} aria-label="Unité d’allure" value={i.unit} onChange={(e) => onChange({ ...i, unit: e.target.value as 'per_km' | 'per_100m' })}>
              <option value="per_km">/km</option><option value="per_100m">/100 m</option>
            </select>
          </>
        ) : null}
        {i.kind === 'power' ? (
          <>
            {num('Puissance basse', i.min, (n) => onChange({ ...i, min: n ?? 1 }), 1, 2500)} à {num('Puissance haute (facultatif)', i.max, (n) => onChange({ ...i, max: n }), 1, 2500)}
            <select className={s.control} aria-label="Unité de puissance" value={i.unit} onChange={(e) => onChange({ ...i, unit: e.target.value as 'w' | 'pct_ftp' })}>
              <option value="w">W</option><option value="pct_ftp">% FTP</option>
            </select>
          </>
        ) : null}
        {i.kind === 'hr' ? (
          <>
            {num('Fréquence basse', i.min, (n) => onChange({ ...i, min: n ?? 30 }), 30, 250)} à {num('Fréquence haute (facultatif)', i.max, (n) => onChange({ ...i, max: n }), 30, 250)}
            <select className={s.control} aria-label="Unité de fréquence cardiaque" value={i.unit} onChange={(e) => onChange({ ...i, unit: e.target.value as 'bpm' | 'pct_max' })}>
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

// ---------- Cardio sur machine en paliers (D-164) ----------

const UNIT: Record<StageSetting, (m: Machine) => string> = {
  level: () => '', speedKmh: () => 'km/h', inclinePct: () => '%', cadence: (m) => CADENCE_UNIT[m], watts: () => 'W', split500: () => '/500 m', rpe: () => '/10',
};
const BOUNDS: Record<Exclude<StageSetting, 'split500'>, { min: number; max: number; step: number }> = {
  level: { min: 1, max: 40, step: 1 }, speedKmh: { min: 0.5, max: 40, step: 0.1 }, inclinePct: { min: -10, max: 40, step: 0.5 },
  cadence: { min: 10, max: 250, step: 1 }, watts: { min: 1, max: 2500, step: 5 }, rpe: { min: 1, max: 10, step: 1 },
};
const fit = (v: number, b: { min: number; max: number; step: number }) => Math.min(b.max, Math.max(b.min, Math.round(v / b.step) * b.step));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Un réglage d’un palier ; vide = non précisé. */
function StageInput({ k, machine, value, label, onChange }: { k: StageSetting; machine: Machine; value: number | null; label: string; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','));
  if (k === 'split500') {
    return <span className={s.inline}><PaceInput id={`${label}-split`} label={label} value={value} onChange={(v) => onChange(v === null ? null : Math.min(600, Math.max(60, v)))} /><span className={s.muted}>/500 m</span></span>;
  }
  const b = BOUNDS[k];
  return (
    <span className={s.inline}>
      <input className={cx(s.control, s.stageNum)} aria-label={label} inputMode="decimal" value={text} placeholder="—"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const t = text.trim().replace(',', '.');
          if (t === '' || Number.isNaN(Number(t))) { setText(''); return onChange(null); }
          const v = k === 'speedKmh' || k === 'inclinePct' ? round1(fit(Number(t), b)) : fit(Number(t), b);
          setText(String(v).replace('.', ','));
          onChange(v);
        }} />
      {UNIT[k](machine) ? <span className={s.muted}>{UNIT[k](machine)}</span> : null}
    </span>
  );
}

let stageSeq = 0;
const newStageKey = () => `st${++stageSeq}`;

function CardioEditor({ id, cardio, onChange }: { id: string; cardio: Cardio; onChange: (c: Cardio) => void }) {
  const available = MACHINE_SETTINGS[cardio.machine];
  const used = (m: Machine, c: Cardio) => MACHINE_SETTINGS[m].filter((k) => c.stages.some((x) => x[k] !== null));
  const [shown, setShown] = useState<StageSetting[]>(() => available.filter((k) => MACHINE_DEFAULT_SETTINGS[cardio.machine].includes(k) || used(cardio.machine, cardio).includes(k)));
  const [notes, setNotes] = useState(cardio.stages.some((x) => x.note));
  // Clés stables des paliers : un palier déplacé garde ses champs (et ce qu’on y tape).
  const [keys, setKeys] = useState<string[]>(() => cardio.stages.map(() => newStageKey()));
  const ks = keys.length === cardio.stages.length ? keys : cardio.stages.map((_, i) => keys[i] ?? `p${i}`);
  const commit = (stages: Stage[], nextKeys: string[]) => { setKeys(nextKeys); onChange({ ...cardio, stages }); };
  const setStage = (i: number, st: Stage) => onChange({ ...cardio, stages: cardio.stages.map((x, j) => (j === i ? st : x)) });
  const list = useRef<HTMLOListElement>(null);
  const [said, setSaid] = useState('');
  const [dragKey, setDragKey] = useState<string | null>(null);
  const latest = useRef({ cardio, ks, commit });
  latest.current = { cardio, ks, commit };
  /** D-170 : déplacer un palier (poignée glissée, flèches du clavier). */
  const moveStage = (from: number, to: number) => {
    const { cardio: c, ks: k, commit: save } = latest.current;
    if (from === to || to < 0 || to >= c.stages.length) return false;
    const stages = [...c.stages]; const nk = [...k];
    stages.splice(to, 0, stages.splice(from, 1)[0]!);
    nk.splice(to, 0, nk.splice(from, 1)[0]!);
    latest.current = { ...latest.current, cardio: { ...c, stages }, ks: nk };
    save(stages, nk);
    return true;
  };
  useEffect(() => {
    if (!dragKey) return;
    const onMove = (e: PointerEvent) => {
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('[data-stage]') ?? [])];
      const from = latest.current.ks.indexOf(dragKey);
      const at = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
      const p = at === -1 ? rows.length : at;
      moveStage(from, p > from ? p - 1 : p);
    };
    const onUp = () => {
      setSaid(`Palier déplacé en position ${latest.current.ks.indexOf(dragKey) + 1}`);
      setDragKey(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragKey]);
  const total = stagesSeconds(cardio);
  const bars = stageProfile(cardio);
  return (
    <div className={s.cardio}>
      <div className={s.field}>
        <label className={s.label} htmlFor={`${id}-machine`}>Machine</label>
        <select id={`${id}-machine`} className={s.control} value={cardio.machine} onChange={(e) => {
          const m = e.target.value as Machine;
          // Les réglages que la nouvelle machine n’a pas sont retirés des paliers.
          const keep = new Set(MACHINE_SETTINGS[m]);
          const stages = cardio.stages.map((x) => ({ ...x, ...Object.fromEntries(MACHINE_SETTINGS.other.concat(['split500']).filter((k) => !keep.has(k)).map((k) => [k, null])) }) as Stage);
          const next = { machine: m, stages };
          setShown(MACHINE_SETTINGS[m].filter((k) => MACHINE_DEFAULT_SETTINGS[m].includes(k) || used(m, next).includes(k)));
          onChange(next);
        }}>
          {MACHINES.map((m) => <option key={m} value={m}>{MACHINE_LABELS[m]}</option>)}
        </select>
      </div>
      <div className={s.field} role="group" aria-label="Réglages à donner pour chaque palier">
        <span className={s.label}>Réglages</span>
        <span className={s.seg}>
          {available.map((k) => (
            <label key={k} className={s.segItem}>
              <input type="checkbox" checked={shown.includes(k)} onChange={(e) => {
                if (e.target.checked) setShown(available.filter((x) => x === k || shown.includes(x)));
                else {
                  setShown(shown.filter((x) => x !== k));
                  onChange({ ...cardio, stages: cardio.stages.map((x) => ({ ...x, [k]: null })) });
                }
              }} />{STAGE_SETTING_LABELS[k]}
            </label>
          ))}
          <label className={s.segItem}>
            <input type="checkbox" checked={notes} onChange={(e) => {
              setNotes(e.target.checked);
              if (!e.target.checked) onChange({ ...cardio, stages: cardio.stages.map((x) => ({ ...x, note: null })) });
            }} />Note
          </label>
        </span>
      </div>
      <ol className={cx(s.stages, dragKey && s.sorting)} aria-label="Paliers" ref={list}>
        {cardio.stages.map((x, i) => (
          <li key={ks[i]} data-stage={ks[i]} className={cx(s.stageRow, dragKey === ks[i] && s.stageDragging)}>
            <span className={s.stageLead}>
              {cardio.stages.length > 1 ? (
                <button type="button" className={s.handle} data-stage-handle={ks[i]}
                  aria-label={`Déplacer le palier ${i + 1} : glisser, ou flèches haut et bas`} title="Glisser pour déplacer le palier"
                  onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); setDragKey(ks[i]!); }}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    const key = ks[i]!, to = i + (e.key === 'ArrowUp' ? -1 : 1);
                    if (!moveStage(i, to)) return;
                    setSaid(`Palier déplacé en position ${to + 1}`);
                    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-stage-handle="${key}"]`)?.focus());
                  }}>
                  <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
                    {[3, 10, 17].map((y) => [4, 10].map((cx_) => <circle key={`${cx_}${y}`} cx={cx_} cy={y} r="1.8" fill="currentColor" />))}
                  </svg>
                </button>
              ) : null}
              <span className={s.stageNo} aria-hidden="true">{i + 1}</span>
            </span>
            <span className={s.stageFields} role="group" aria-label={`Palier ${i + 1}`}>
              <TimeInputs seconds={x.seconds} label={`du palier ${i + 1}`} compact
                onChange={(sec) => setStage(i, { ...x, seconds: Math.min(14_400, Math.max(5, sec)) })} />
              {shown.map((k) => (
                <span key={k} className={s.inline}>
                  <span className={s.stageLabel}>{STAGE_SETTING_LABELS[k]}</span>
                  <StageInput k={k} machine={cardio.machine} value={x[k]} label={`${STAGE_SETTING_LABELS[k]} du palier ${i + 1}`} onChange={(v) => setStage(i, { ...x, [k]: v })} />
                </span>
              ))}
              {notes ? (
                <input className={cx(s.control, s.stageNote)} aria-label={`Note du palier ${i + 1}`} maxLength={80} value={x.note ?? ''} placeholder="Par exemple : sans les mains"
                  onChange={(e) => setStage(i, { ...x, note: e.target.value || null })} />
              ) : null}
            </span>
            <span className={s.stageTools}>
              <IconButton icon="copy" label={`Dupliquer le palier ${i + 1}`} variant="ghost" size="sm"
                onClick={() => commit(
                  [...cardio.stages.slice(0, i + 1), { ...x }, ...cardio.stages.slice(i + 1)].slice(0, 30),
                  [...ks.slice(0, i + 1), newStageKey(), ...ks.slice(i + 1)].slice(0, 30),
                )} />
              {cardio.stages.length > 1 ? (
                <IconButton icon="close" label={`Retirer le palier ${i + 1}`} variant="ghost" size="sm"
                  onClick={() => commit(cardio.stages.filter((_, j) => j !== i), ks.filter((_, j) => j !== i))} />
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <Cluster gap={3} align="center">
        <Button size="sm" icon="plus" disabled={cardio.stages.length >= 30}
          onClick={() => { const last = cardio.stages[cardio.stages.length - 1]!; commit([...cardio.stages, blankStage(last.seconds, last)], [...ks, newStageKey()]); }}>Palier</Button>
        <span className={s.hint}><strong>{formatClock(total)}</strong> en {cardio.stages.length} palier{cardio.stages.length > 1 ? 's' : ''}</span>
        {bars.length ? (
          <span className={s.stageBars} aria-hidden="true">{bars.map((b, i) => <span key={i} style={{ flexGrow: b.seconds, blockSize: `${Math.round(b.height * 100)}%` }} />)}</span>
        ) : null}
      </Cluster>
      <span className="ds-visually-hidden" role="status">{said}</span>
    </div>
  );
}

// ---------- Déplacement (glisser-déposer, clavier, menu) ----------

interface DnD {
  dragging: string | null;
  start: (key: string, e: ReactPointerEvent<HTMLElement>, label: string) => void;
  onHandleKey: (key: string, e: ReactKeyboardEvent<HTMLElement>) => void;
  lift: (key: string) => void;
}

/** Poignée : glisser à la souris ou au doigt ; flèches haut et bas au clavier. */
function Handle({ k, index, label, dnd }: { k: string; index: string; label: string; dnd: DnD }) {
  return (
    <button type="button" className={s.handle} data-handle={k}
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

/** Outils d’un bloc : dupliquer, supprimer et, dans une répétition, « Sortir de la répétition ». On déplace un bloc par sa poignée (D-185). */
function Tools({ k, index, inside, dnd, onDuplicate, onRemove }: { k: string; index: string; inside: boolean; dnd: DnD; onDuplicate: () => void; onRemove: () => void }) {
  return (
    <span className={s.tools}>
      <IconButton icon="copy" size="sm" onClick={onDuplicate} label={`Dupliquer le bloc ${index}`} />
      <IconButton icon="trash" size="sm" onClick={onRemove} label={`Supprimer le bloc ${index}`} />
      {inside ? (
        <Popover iconOnly icon="more" label={`Plus d’actions pour le bloc ${index}`}>
          {(close) => <MenuItem onClick={() => { dnd.lift(k); close(); }}>Sortir de la répétition</MenuItem>}
        </Popover>
      ) : null}
    </span>
  );
}

// ---------- Étape et répétition ----------

/** D-165 : un exercice en séries (séries, ce qu’on fait par série, charge, récupération entre les séries). */
interface SeriesControls { sets: number; rest: number; onSets: (n: number) => void; onRest: (seconds: number) => void; onCircuit: () => void }

function StepEditor({ step, sport, index, refs, onChange, head, tools, series }: { step: EStep; sport: Sport; index: string; refs?: References; onChange: (s: EStep) => void; head: React.ReactNode; tools: React.ReactNode; series?: SeriesControls }) {
  const id = useId();
  const [noteOpen, setNoteOpen] = useState(Boolean(step.note));
  const stepSport = step.sport ?? (MULTISPORT.includes(sport) ? null : sport);
  const zone = step.intensity.kind === 'zone' ? step.intensity.zone : null;
  const { _k: _ignored, ...plain } = step;
  const est = stepEstimate(plain, sport, refs);
  const strength = stepSport === 'strength' || sport === 'strength';
  const allExercises = useContext(ExercisesCtx);
  // D-185 : séries différentes (charge, répétitions), dans une carte de plusieurs séries.
  const canVary = Boolean(series && series.sets > 1 && strength && (step.measure.kind === 'reps' || step.intensity.kind === 'load'));
  const perSet = canVary && step.perSet ? fitSetsToTimes(step, series!.sets).perSet ?? null : null;
  const fitSets = (x: EStep): EStep => (series && series.sets > 1 && x.perSet ? { ...fitSetsToTimes(x, series.sets), _k: x._k } : x);
  const pickOne = useContext(PickOneCtx);
  const athlete = useContext(GearCtx);
  // D-111 : pour un élève qui a dit où il s’entraîne, les exercices faisables d’abord.
  const fit = (x: ExerciseOption) => exerciseFits(x.equipment ?? [], athlete?.gear ?? null);
  const exercises = [...allExercises].sort((p, q) => Number(fit(q) !== false) - Number(fit(p) !== false));
  const chosen = step.exercise?.id ? allExercises.find((x) => x.id === step.exercise!.id) : undefined;
  const chosenFits = chosen ? fit(chosen) : null;
  const last = useContext(LastCtx);
  const lastDone = step.exercise ? last[exerciseKey(step.exercise.id, step.exercise.name)] : undefined;
  const hint = [
    zone ? `Z${zone} · ${ZONE_NAMES[zone as Zone]}` : null,
    zone ? personalTarget(plain, sport, refs) : null,
    est.meters ? `environ ${formatKm(est.meters)}` : null,
    est.seconds ? `environ ${formatClock(est.seconds)}` : null,
  ].filter(Boolean);
  return (
    <div className={cx(s.step, (step.phase === 'recovery' || step.phase === 'rest') && s.easy)} data-zone={zone ?? undefined} role="group" aria-label={`Bloc ${index}`}>
      <div className={s.head}>
        {head}
        {series ? <span className={s.seriesTag}>{series.sets > 1 ? `${series.sets} séries` : '1 série'}</span> : (
          <select className={cx(s.control, s.phase)} aria-label={`Type du bloc ${index}`} value={step.phase} onChange={(e) => onChange({ ...step, phase: e.target.value as Phase })}>
            {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
          </select>
        )}
        {step.sport === 'strength' && sport !== 'strength' && !MULTISPORT.includes(sport) ? (
          <button type="button" className={s.sportTag} title="Étape de renforcement dans une séance d’endurance ; toucher pour la remettre en course"
            onClick={() => onChange({ ...step, sport: null, exercise: null, measure: step.measure.kind === 'reps' ? { kind: 'time', seconds: 600 } : step.measure, intensity: step.intensity.kind === 'load' ? { kind: 'none' } : step.intensity })}>Renfo<Icon name="close" size={14} /></button>
        ) : null}
        {MULTISPORT.includes(sport) ? (
          <select className={s.control} aria-label={`Sport du bloc ${index}`} value={step.sport ?? ''} onChange={(e) => onChange({ ...step, sport: (e.target.value || null) as Sport | null })}>
            <option value="">Sport…</option>
            {(MULTI_STEP_SPORTS[sport] ?? SPORTS).map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
          </select>
        ) : null}
        <span className={s.spacer} />
        {tools}
      </div>
      <div className={s.body}>
        {(strength || step.cardio) && step.phase !== 'rest' && step.phase !== 'recovery' ? (
          <div className={s.field}>
            <label className={s.label} htmlFor={`${id}-ex`}>{step.cardio ? 'Nom (facultatif)' : 'Exercice'}</label>
            <input id={`${id}-ex`} className={s.control} list={`${id}-exl`} maxLength={80} value={step.exercise?.name ?? ''}
              placeholder={step.cardio ? MACHINE_LABELS[step.cardio.machine] : exercises.length ? 'Choisis ou écris un exercice' : 'Ex. Squat goblet'}
              onChange={(e) => {
                const name = e.target.value;
                const hit = exercises.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
                onChange({ ...step, exercise: name.trim() ? { id: hit?.id ?? null, name: hit?.name ?? name } : null });
              }} />
            <datalist id={`${id}-exl`}>{exercises.map((x) => <option key={x.id} value={x.name} label={fit(x) === false ? 'matériel absent' : undefined} />)}</datalist>
            {step.exercise && !step.exercise.id && exercises.length ? <span className={s.hint}>Pas dans ta bibliothèque : l’élève verra le nom, sans vidéo.</span> : null}
            {pickOne && !step.cardio ? (
              <span><Button size="sm" variant="ghost" icon="list" onClick={() => pickOne((x) => onChange({ ...step, exercise: { id: x.id, name: x.name } }))}>Choisir une machine</Button></span>
            ) : null}
            {lastDone ? <span className={s.hint}>Dernière fois : <strong>{lastDone.text}</strong> ({formatShortDate(lastDone.date)})</span> : null}
            {chosen && chosenFits === false && athlete ? (
              <span className={cx(s.hint, s.warn)} role="note"><Icon name="alert" size={14} /> D’après son bilan, {athlete.first} n’a pas le matériel ({missingEquipment(chosen.equipment ?? [])}) : choisis une variante, ou parlez-en ensemble.</span>
            ) : null}
          </div>
        ) : null}
        {step.cardio ? (
          <CardioEditor id={id} cardio={step.cardio} onChange={(c) => onChange(withCardio(step, c))} />
        ) : (
          <>
            {series ? (
              <div className={s.field}>
                <label className={s.label} htmlFor={`${id}-sets`}>Séries</label>
                <input id={`${id}-sets`} type="number" min={1} max={50} className={cx(s.control, s.numCompact)} value={series.sets}
                  onChange={(e) => series.onSets(Math.min(50, Math.max(1, Math.round(Number(e.target.value) || 1))))} />
                <span className={s.muted}>{step.perSet ? '×' : '×, chacune :'}</span>
              </div>
            ) : null}
            <MeasureEditor id={id} m={step.measure} strength={strength} hideValue={Boolean(perSet)} onChange={(m) => onChange(fitSets({ ...step, measure: m }))} />
            <IntensityEditor id={id} i={step.intensity} sport={strength ? 'strength' : (stepSport ?? 'running')} hideValue={Boolean(perSet)} onChange={(i) => onChange(fitSets({ ...step, intensity: i }))} />
            {perSet ? (
              <SetsTable id={id} step={step} sets={perSet} onChange={onChange} />
            ) : canVary ? (
              <span><Button size="sm" variant="ghost" icon="list" onClick={() => onChange(varySets(step, series!.sets))} title="Charge et répétitions propres à chaque série (ex. 12 × 10 kg, 10 × 12 kg, 8 × 14 kg)">Varier d’une série à l’autre</Button></span>
            ) : null}
            {series && series.sets > 1 ? (
              <div className={s.field}>
                <span className={s.label} id={`${id}-rest`}>Récupération entre les séries</span>
                <span role="group" aria-labelledby={`${id}-rest`}>
                  <TimeInputs key={`rest-${series.sets > 1}`} seconds={series.rest} compact label="de récupération" allowZero onChange={series.onRest} />
                </span>
              </div>
            ) : null}
            {hint.length ? <p className={s.hint}>{hint.join(' · ')}</p> : null}
            {strength && (!series || series.sets <= 1) && step.measure.kind === 'time' && step.phase !== 'rest' && step.phase !== 'recovery' ? (
              <span><Button size="sm" variant="ghost" icon="chart" onClick={() => onChange(withCardio(step, {
                machine: guessMachine(step.exercise?.name),
                stages: [blankStage(step.measure.kind === 'time' ? step.measure.seconds : 600, step.intensity.kind === 'rpe' ? { ...blankStage(0), rpe: step.intensity.min } : undefined)],
              }))}>Cardio sur machine : passer en paliers</Button></span>
            ) : null}
          </>
        )}
        {noteOpen ? (
          <div className={cx(s.field, s.noteField)}>
            <label className={s.label} htmlFor={`${id}-note`}>Note</label>
            <textarea id={`${id}-note`} className={cx(s.control, s.noteArea)} rows={2} maxLength={200} value={step.note ?? ''} placeholder="Par exemple : en côte, pieds rapides, pull-buoy"
              onChange={(e) => onChange({ ...step, note: e.target.value || null })} />
          </div>
        ) : (
          <span><Button size="sm" variant="ghost" icon="plus" onClick={() => setNoteOpen(true)}>Ajouter une note</Button></span>
        )}
        {series ? (
          <span><Button size="sm" variant="ghost" icon="repeat" onClick={series.onCircuit}>Enchaîner un autre exercice (circuit)</Button></span>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Exercice en séries (D-165) ----------

/** D-185 · Première série = réglages de la carte ; les suivantes reprennent la même chose, à ajuster. */
function varySets(step: EStep, sets: number): EStep {
  const reps = step.measure.kind === 'reps' ? step.measure.reps : null;
  const kg = step.intensity.kind === 'load' ? step.intensity.min : null;
  return { ...step, perSet: Array.from({ length: sets }, () => ({ reps, kg })) };
}
function withoutSets(step: EStep): EStep {
  const { perSet: _drop, ...rest } = step;
  return rest as EStep;
}

/**
 * D-185 · Les séries une par une (« 12 × 10 kg, 10 × 12 kg, 8 × 14 kg ») : répétitions et charge propres à chaque série.
 * La première série reste celle de la carte (résumés, montre, ancien affichage).
 */
function SetsTable({ id, step, sets, onChange }: { id: string; step: EStep; sets: SetPlan[]; onChange: (s: EStep) => void }) {
  const reps = step.measure.kind === 'reps';
  const load = step.intensity.kind === 'load';
  const set = (k: number, patch: Partial<SetPlan>) => {
    const next = sets.map((x, i) => (i === k ? { ...x, ...patch } : x));
    const first = next[0]!;
    onChange({
      ...step, perSet: next,
      measure: reps && first.reps ? { kind: 'reps', reps: first.reps } : step.measure,
      intensity: load && first.kg ? { kind: 'load', min: first.kg, max: null } : step.intensity,
    });
  };
  const num = (v: string, max: number, stepBy = 1) => Math.min(max, Math.max(stepBy, Math.round((Number(v.replace(',', '.')) || stepBy) / stepBy) * stepBy));
  // Raccourci de salle : la charge monte d’un même écart à chaque série (ex. +2,5 kg).
  const ramp = (by: number) => onChange({ ...step, perSet: sets.map((x, i) => ({ ...x, kg: Math.min(500, Math.max(0.5, (sets[0]!.kg ?? 0.5) + by * i)) })) });
  // Colonnes alignées sur les cases : série, répétitions (si en répétitions), charge (si en kg).
  const cols = { gridTemplateColumns: ['36px', reps ? '88px' : null, load ? 'auto' : null].filter(Boolean).join(' ') };
  return (
    <div className={s.sets} role="group" aria-label="Séries, une par une">
      <div className={s.setsRow} style={cols} aria-hidden="true">
        <span className={s.setsHead}>Série</span>
        {reps ? <span className={s.setsHead}>Rép.</span> : null}
        {load ? <span className={s.setsHead}>Charge</span> : null}
      </div>
      {sets.map((x, k) => (
        <div key={k} className={s.setsRow} style={cols}>
          <span className={s.setsK}>{k + 1}</span>
          {reps ? (
            <input id={k ? undefined : `${id}-set-reps`} aria-label={`Répétitions de la série ${k + 1}`} type="number" inputMode="numeric" min={1} max={500}
              className={cx(s.control, s.num)} value={x.reps ?? ''} onChange={(e) => set(k, { reps: num(e.target.value, 500) })} />
          ) : null}
          {load ? (
            <span className={s.inline}>
              <input aria-label={`Charge de la série ${k + 1} en kg`} type="number" inputMode="decimal" min={0.5} max={500} step={0.5}
                className={cx(s.control, s.num)} value={x.kg ?? ''} onChange={(e) => set(k, { kg: num(e.target.value, 500, 0.5) })} /> kg
            </span>
          ) : null}
        </div>
      ))}
      <Cluster gap={2}>
        {load ? <Button size="sm" variant="ghost" onClick={() => ramp(2.5)}>+2,5 kg par série</Button> : null}
        {load ? <Button size="sm" variant="ghost" onClick={() => ramp(5)}>+5 kg par série</Button> : null}
        <Button size="sm" variant="ghost" icon="close" onClick={() => onChange(withoutSets(step))}>Mêmes réglages pour toutes</Button>
      </Cluster>
    </div>
  );
}

/** Un exercice en séries : une seule étape d’effort, répétée, éventuellement suivie d’une récupération. */
interface SeriesShape { sets: number; work: EStep; rest: EStep | null }
const isRestStep = (x: EBlock | undefined): x is EStep =>
  Boolean(x && x.type === 'step' && (x.phase === 'rest' || x.phase === 'recovery') && !x.exercise && !x.cardio && x.measure.kind === 'time');
function seriesOf(b: EBlock, strengthSession: boolean): SeriesShape | null {
  const work = (x: EBlock | undefined): x is EStep =>
    Boolean(x && x.type === 'step' && x.phase === 'work' && !x.cardio && (strengthSession || x.sport === 'strength'));
  if (b.type === 'step') return work(b) ? { sets: 1, work: b, rest: null } : null;
  const [a, r] = b.steps;
  if (b.steps.length === 1 && work(a)) return { sets: b.times, work: a, rest: null };
  if (b.steps.length === 2 && work(a) && isRestStep(r)) return { sets: b.times, work: a, rest: r };
  return null;
}
/** Reconstruit le bloc : une série = l’étape seule ; plusieurs = une répétition (effort + récupération si elle dure). */
function seriesBlock(k: string, shape: SeriesShape, sets: number, rest: number, work: EStep): EBlock {
  if (sets <= 1) return { ...work, _k: k };
  const inner = shape.sets <= 1 ? { ...work, _k: key() } : work;
  const restStep: EStep | null = rest > 0
    ? { ...(shape.rest ?? newStep('rest', work.sport === 'strength' ? 'strength' : null)), measure: { kind: 'time', seconds: rest } }
    : null;
  return { type: 'repeat', times: sets, _k: k, steps: restStep ? [inner, restStep] : [inner] };
}

function SeriesCard({ block, shape, sport, index, refs, head, tools, onChange }: {
  block: EBlock; shape: SeriesShape; sport: Sport; index: string; refs?: References; head: React.ReactNode; tools: React.ReactNode; onChange: (b: EBlock) => void;
}) {
  const current = shape.rest?.measure.kind === 'time' ? shape.rest.measure.seconds : 0;
  // Récupération gardée en mémoire quand on repasse à une seule série, pour la retrouver ensuite.
  const [remembered, setRemembered] = useState(current || (shape.work.measure.kind === 'time' ? 30 : 90));
  const rest = shape.sets > 1 ? current : remembered;
  return (
    <StepEditor step={shape.work} sport={sport} index={index} refs={refs} head={head} tools={tools}
      onChange={(w) => onChange(seriesBlock(block._k, shape, shape.sets, rest, w))}
      series={{
        sets: shape.sets, rest,
        onSets: (n) => onChange(seriesBlock(block._k, shape, n, rest, n > 1 ? { ...fitSetsToTimes(shape.work, n), _k: shape.work._k } : withoutSets(shape.work))),
        onRest: (sec) => { setRemembered(sec || remembered); onChange(seriesBlock(block._k, shape, shape.sets, sec, shape.work)); },
        onCircuit: () => onChange({
          type: 'repeat', times: Math.max(2, shape.sets), _k: block._k,
          steps: [shape.sets <= 1 ? { ...shape.work, _k: key() } : shape.work, { ...newStrengthStep('work'), sport: shape.work.sport },
            ...(rest > 0 ? [{ ...(shape.rest ?? newStep('rest', shape.work.sport)), measure: { kind: 'time' as const, seconds: rest } }] : [])],
        }),
      }} />
  );
}

function BlockList({ blocks, sport, depth, prefix, parent, refs, dnd, onChange }: {
  blocks: EBlock[]; sport: Sport; depth: number; prefix: string; parent: string | null; refs?: References; dnd: DnD; onChange: (b: EBlock[]) => void;
}) {
  const update = (k: number, b: EBlock) => onChange(blocks.map((x, i) => (i === k ? b : x)));
  const fold = useContext(FoldCtx);
  return (
    <ol className={s.list} data-b="list" data-depth={depth} data-parent={parent ?? ''}>
      {blocks.map((b, k) => {
        const index = prefix ? `${prefix}.${k + 1}` : String(k + 1);
        const label = describeBlock(fromEditor([b])[0]!, sport);
        const head = (
          <>
            <Handle k={b._k} index={index} label={label} dnd={dnd} />
            <span className={s.index} aria-hidden="true">{index}</span>
          </>
        );
        const folded = depth === 0 && fold.folded.has(b._k);
        // Résumé de la carte réduite : « Squat goblet » puis « 3 séries · 10 répétitions · repos 1 min 30 s ».
        const row = folded ? sessionView(fromEditor([b]), sport, refs).rows[0] : undefined;
        const foldButton = depth === 0 ? (
          <button type="button" className={cx(s.fold, !folded && s.foldOpen)} aria-expanded={!folded}
            aria-label={folded ? `Déplier le bloc ${index}` : `Réduire le bloc ${index}`} onClick={() => fold.toggle(b._k)}>
            <Icon name="chevronDown" size={18} />
          </button>
        ) : null;
        const tools = (
          <>
            {foldButton}
            <Tools k={b._k} index={index} inside={parent !== null} dnd={dnd}
              onDuplicate={() => onChange([...blocks.slice(0, k + 1), clone(b), ...blocks.slice(k + 1)])}
              onRemove={() => onChange(blocks.filter((_, i) => i !== k))} />
          </>
        );
        const shape = depth === 0 ? seriesOf(b, sport === 'strength') : null;
        return (
          <li key={b._k} data-bk={b._k} data-kind={b.type} className={dnd.dragging === b._k ? s.dragging : undefined}>
            {folded ? (
              // D-186 : une ligne, le résumé que lira l’élève ; toucher le résumé déplie la carte.
              <div className={cx(s.step, s.folded)} role="group" aria-label={`Bloc ${index}`}>
                <div className={s.head}>
                  {head}
                  <span className={s.spacer} />
                  {tools}
                </div>
                <button type="button" className={s.foldSummary} onClick={() => fold.toggle(b._k)}>
                  {row?.title ? <span className={s.foldTitle}>{row.title}</span> : null}
                  <span className={s.foldDetail}>{row?.detail ?? (row?.title ? null : label)}</span>
                </button>
              </div>
            ) : shape ? (
              <SeriesCard block={b} shape={shape} sport={sport} index={index} refs={refs} head={head} tools={tools} onChange={(x) => update(k, x)} />
            ) : b.type === 'step' ? (
              <StepEditor step={b} sport={sport} index={index} refs={refs} onChange={(s) => update(k, s)} head={head} tools={tools} />
            ) : (
              <div className={cx(s.repeat, depth > 0 && s.nested)} data-b="repeat" role="group" aria-label={`Répétition ${index}`}>
                <div className={cx(s.head, s.repeatHead)} data-b="repeat-head">
                  {head}
                  <span className={s.repeatIcon} aria-hidden="true"><Icon name="repeat" size={16} /></span>
                  <label className={cx(s.inline, s.times)}>Répéter
                    <input type="number" className={cx(s.control, s.num)} min={2} max={50} value={b.times} aria-label={`Nombre de répétitions du bloc ${index}`}
                      onChange={(e) => update(k, { ...b, times: Math.min(50, Math.max(2, Number(e.target.value) || 2)) })} /> fois
                  </label>
                  <span className={s.spacer} />
                  {tools}
                </div>
                <BlockList blocks={b.steps} sport={sport} depth={depth + 1} prefix={index} parent={b._k} refs={refs} dnd={dnd} onChange={(steps) => update(k, { ...b, steps })} />
                <div className={s.repeatFoot} data-b="repeat-foot">
                  <Button size="sm" icon="plus" onClick={() => update(k, { ...b, steps: [...b.steps, newStep('recovery')] })}>Étape dans la répétition</Button>
                  {depth === 0 ? <Button size="sm" icon="plus" onClick={() => update(k, { ...b, steps: [...b.steps, newRepeat()] })}>Série imbriquée</Button> : null}
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
export function WorkoutBuilder({ wid, sport, value, onChange, refs, athleteFirst, vmaHref, library, exercises: listed = [], strengthOn = true, gear, lastDone, dictation }: {
  /** D-181 : espace du coach, pour ajouter des exercices de machine à sa bibliothèque depuis la séance. */
  wid?: string;
  /** IA-1 (D-189) : « Dicter ou écrire avec l’IA », quand l’IA est allumée pour l’espace ; élève visé ou null. */
  dictation?: { athleteId: string | null };
  sport: Sport; value: EBlock[]; onChange: (b: EBlock[]) => void; refs?: References; athleteFirst?: string; vmaHref?: string;
  /** D-074 : blocs réutilisables du coach (insérer, garder). Absent : seulement les modèles rapides. */
  library?: { wid: string; blocks: SavedBlock[] };
  /** D-096 : exercices de la bibliothèque, proposés dans les blocs de musculation. */
  exercises?: ExerciseOption[];
  /** D-102 : module musculation actif ; une séance d’endurance peut alors finir par du renforcement. */
  strengthOn?: boolean;
  /** D-111 : matériel de l’élève (séance individuelle). */
  gear?: AthleteGearInfo | null;
  /** D-112 : dernière fois de l’élève, par exercice (séance individuelle). */
  lastDone?: Record<string, LastDone>;
}) {
  const presets = presetsFor(sport);
  // D-181 : exercices de machine entrés dans la bibliothèque pendant cette séance, proposés aussitôt dans les autres étapes.
  const [added, setAdded] = useState<ExerciseOption[]>([]);
  const exercises = [...listed, ...added.filter((a) => !listed.some((x) => x.id === a.id))];
  const remember = (items: PickedExercise[]) => setAdded((list) => [...list, ...items.filter((x) => !list.some((y) => y.id === x.id))]);
  const [picker, setPicker] = useState<null | { mode: 'many' } | { mode: 'one'; onPick: (x: PickedExercise) => void }>(null);
  const [gym, setGym] = useState<Gym>('all');
  useEffect(() => { setGym(readGym()); }, []);
  const pickOne = wid ? (onPick: (x: PickedExercise) => void) => setPicker({ mode: 'one', onPick }) : null;
  const [mine, setMine] = useState<SavedBlock[]>(library?.blocks ?? []);
  const usable = mine.filter((b) => !b.sport || b.sport === sport);
  const blocks = fromEditor(value);
  const totals = structureTotals(blocks, { sport, refs });
  const defaultSport = MULTISPORT.includes(sport) ? (MULTI_STEP_SPORTS[sport]?.[0] ?? null) : null;
  const root = useRef<HTMLElement>(null);
  const [drag, setDrag] = useState<{ key: string; label: string; x: number; y: number; active: boolean } | null>(null);
  // D-186 : cartes réduites ; en ajouter une replie celles déjà écrites, pour se concentrer sur la nouvelle.
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleFold = (k: string) => setFolded((f) => { const n = new Set(f); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const add = (...more: EBlock[]) => { setFolded(new Set(value.map((b) => b._k))); onChange([...value, ...more]); };
  const allFolded = value.length > 0 && value.every((b) => folded.has(b._k));
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
      const list = root.current.querySelector<HTMLElement>('[data-b="list"][data-depth="0"]');
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
      const head = li.querySelector<HTMLElement>(':scope > [data-b="repeat"] > [data-b="repeat-head"]')!.getBoundingClientRect();
      const inner = li.querySelector<HTMLElement>(':scope > [data-b="repeat"] > [data-b="list"]')!;
      const ir = inner.getBoundingClientRect();
      if (y < head.top + head.height / 2) return { parent, before: k, top: r.top - 6, left: lr.left, width: lr.width };
      if (y <= head.bottom + 4) {
        const first = inner.firstElementChild as HTMLElement | null;
        return { parent: k, before: first?.dataset.bk ?? null, top: ir.top - 4, left: ir.left, width: ir.width };
      }
      if (el.closest('[data-b="repeat-foot"]') && el.closest('li[data-bk]') === li) return { parent: k, before: null, top: ir.bottom + 3, left: ir.left, width: ir.width };
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
  const view = value.length ? sessionView(blocks, sport, refs) : null;
  return (
    <ExercisesCtx.Provider value={exercises}>
    <PickOneCtx.Provider value={pickOne}>
    <GearCtx.Provider value={gear ?? null}>
    <LastCtx.Provider value={lastDone ?? {}}>
    <section className={cx(s.builder, drag?.active && s.sorting)} aria-labelledby="builder-title" data-tour="builder" ref={root}>
      <Stack gap={1}>
        <h2 id="builder-title" className={s.title}>Déroulé de la séance</h2>
        <Text size="sm" muted>{strength
          ? '« Exercice » : ses séries, ce qu’on fait à chaque série (répétitions ou durée), la charge et la récupération. « Circuit » enchaîne plusieurs exercices en tours ; « Cardio » programme une machine en paliers. Glisse un bloc par sa poignée pour le déplacer.'
          : 'Construis la séance bloc par bloc : durée ou distance, zone, répétitions et séries. Glisse un bloc par sa poignée pour le déplacer.'}
          {wid ? <> <a href={`/coach/${wid}/aide/ecrire-seance`}>Aide</a></> : null}</Text>
      </Stack>
      {value.length > 1 ? (
        <Cluster between align="center">
          <Text size="sm" muted>{value.length} blocs{folded.size ? ` · ${value.filter((b) => folded.has(b._k)).length} réduit${value.filter((b) => folded.has(b._k)).length > 1 ? 's' : ''}` : ''}</Text>
          <Button size="sm" variant="ghost" icon="chevronDown" className={allFolded ? undefined : s.foldAllOpen}
            onClick={() => setFolded(allFolded ? new Set() : new Set(value.map((b) => b._k)))}>{allFolded ? 'Tout déplier' : 'Tout réduire'}</Button>
        </Cluster>
      ) : null}
      {value.length ? (
        <FoldCtx.Provider value={{ folded, toggle: toggleFold }}>
          <BlockList blocks={value} sport={sport} depth={0} prefix="" parent={null} refs={refs} dnd={dnd} onChange={onChange} />
        </FoldCtx.Provider>
      ) : (
        <p className={s.empty}>Aucun bloc pour l’instant. Ajoute une étape, une répétition ou pars d’un modèle.</p>
      )}
      <Cluster gap={2} data-tour="builder-add">
        {strength ? (
          <>
            <Button icon="plus" onClick={() => add(newStrengthRepeat())}>Exercice</Button>
            {wid ? <Button icon="list" title="Choisir des exercices sur machine, Basic-Fit ou toutes les machines" onClick={() => setPicker({ mode: 'many' })}>{gym === 'all' ? 'Machines' : 'Machines Basic-Fit'}</Button> : null}
            <Button icon="repeat" title="Plusieurs exercices enchaînés, en tours" onClick={() => add(newCircuit())}>Circuit</Button>
            <Button icon="plus" title="Tapis, elliptique, vélo, rameur… en paliers (niveau, vitesse, pente)" onClick={() => add(newCardioStep(value.length ? 'work' : 'warmup'))}>Cardio</Button>
          </>
        ) : (
          <>
            <Button icon="plus" onClick={() => add(newStep(value.length ? 'work' : 'warmup', defaultSport))}>Étape</Button>
            <Button icon="repeat" onClick={() => add(newRepeat())}>Répétition</Button>
            {strengthOn && !MULTISPORT.includes(sport) ? (
              <Button icon="plus" title="Séance mixte : renforcement après la course" onClick={() => add(newMixedStrength())}>Renforcement</Button>
            ) : null}
          </>
        )}
        <label className="ds-visually-hidden" htmlFor="preset">Ajouter un modèle</label>
        <Select id="preset" className={s.auto} value="" data-tour="presets"
          onChange={(e) => {
            const p = presets.find((x) => x.id === e.target.value);
            if (p) add(...toEditor(p.blocks()));
          }}>
          <option value="">Modèle rapide…</option>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
        {library ? (
          <>
            <label className="ds-visually-hidden" htmlFor="my-block">Ajouter un de mes blocs</label>
            <Select id="my-block" className={s.auto} value="" disabled={!usable.length}
              onChange={(e) => { const b = usable.find((x) => x.id === e.target.value); if (b) add(...toEditor(b.blocks)); }}>
              <option value="">{usable.length ? 'Mon bloc…' : 'Aucun bloc gardé'}</option>
              {usable.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </Select>
          </>
        ) : null}
      </Cluster>
      {library ? <KeepBlocks wid={library.wid} sport={sport} blocks={blocks} onSaved={(b) => setMine((m) => [...m, b].sort((x, y) => x.title.localeCompare(y.title, 'fr')))} /> : null}
      {dictation && wid ? (
        <AiDictation wid={wid} sport={sport} athleteId={dictation.athleteId} hasBlocks={blocks.length > 0}
          onApply={(raw, mode) => { const bs = linkExercises(raw, exercises); onChange(mode === 'replace' ? toEditor(bs) : [...value, ...toEditor(bs)]); }} />
      ) : null}
      <QuickNotation sport={sport} blocks={blocks} refs={refs}
        onApply={(raw, mode) => { const bs = linkExercises(raw, exercises); onChange(mode === 'replace' ? toEditor(bs) : [...value, ...toEditor(bs)]); }} />
      {view ? (
        <Stack gap={3} className={s.summary} aria-live="polite">
          <Text size="md"><strong>Total :</strong> {describeTotals(totals)}</Text>
          <SessionStrip view={view} height={20} />
          {runSport && !refs?.vmaKmh ? (
            <Text size="sm" muted>Sans VMA, les kilomètres ne sont estimés que pour les blocs avec une allure.
              {vmaHref ? <> <a href={vmaHref}>Renseigner la VMA{athleteFirst ? ` de ${athleteFirst}` : ''}</a></> : null}</Text>
          ) : null}
          {(usesFtp(sport) && !refs?.ftpW) || (usesCss(sport) && !refs?.cssSecPer100) ? (
            <Text size="sm" muted>{usesFtp(sport) ? 'Sans FTP, les zones ne sont pas traduites en watts.' : 'Sans CSS, les zones ne sont pas traduites en allures de nage.'}
              {vmaHref ? <> <a href={vmaHref}>Renseigner {usesFtp(sport) ? 'la FTP' : 'la CSS'}{athleteFirst ? ` de ${athleteFirst}` : ''}</a></> : null}</Text>
          ) : null}
          {totals.unknownTime ? <Text size="sm" muted>Une partie du temps dépend de l’élève (bloc libre ou distance sans allure).</Text> : null}
          <Text size="sm" strong>Ce que lira l’élève :</Text>
          <ol className={s.preview}>{blocks.map((b, k) => <li key={k}>{describeBlock(b, sport)}</li>)}</ol>
        </Stack>
      ) : null}
      <p className="ds-visually-hidden" aria-live="assertive">{announce}</p>
      {drag?.active ? <div className={s.ghost} style={{ left: drag.x + 12, top: drag.y + 12 }} aria-hidden="true">{drag.label}</div> : null}
      {drag?.active && drop ? <div className={s.drop} style={{ top: drop.top, left: drop.left, width: drop.width }} aria-hidden="true" /> : null}
      {picker && wid ? (
        <MachinePicker wid={wid} mode={picker.mode} gym={gym} onGym={setGym} onClose={() => setPicker(null)}
          inSession={new Set(exerciseNames(blocks))}
          onPick={(items) => {
            remember(items);
            if (picker.mode === 'one') { if (items[0]) picker.onPick(items[0]); }
            else add(...items.map(withExercise));
            setPicker(null);
          }} />
      ) : null}
    </section>
    </LastCtx.Provider>
    </GearCtx.Provider>
    </PickOneCtx.Provider>
    </ExercisesCtx.Provider>
  );
}
