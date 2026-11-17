'use client';

import { useId, useState } from 'react';
import {
  describeBlock, describeTotals, PHASES, PHASE_LABELS, presetsFor, SPORTS, SPORT_LABELS, structureTotals, ZONE_LABELS,
  type Block, type Intensity, type Measure, type Phase, type Sport, type Step,
} from '@coachos/domain';

// Constructeur de séance (D-023) : blocs éditables, répétitions et séries, modèles rapides, total en direct.

type EStep = Step & { _k: string };
type ERepeat = { type: 'repeat'; times: number; steps: EBlock[]; _k: string };
export type EBlock = EStep | ERepeat;

let seq = 0;
const key = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export function toEditor(blocks: Block[]): EBlock[] {
  return blocks.map((b) => (b.type === 'step' ? { ...b, _k: key() } : { type: 'repeat', times: b.times, steps: toEditor(b.steps), _k: key() }));
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
const newRepeat = (): ERepeat => ({
  type: 'repeat', times: 5, _k: key(),
  steps: [
    { ...newStep('work'), measure: { kind: 'distance', meters: 400 }, intensity: { kind: 'zone', zone: 5 } },
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

function MeasureEditor({ id, m, onChange }: { id: string; m: Measure; onChange: (m: Measure) => void }) {
  const minutes = m.kind === 'time' ? Math.floor(m.seconds / 60) : 0;
  const seconds = m.kind === 'time' ? m.seconds % 60 : 0;
  const km = m.kind === 'distance' && m.meters >= 1000 && m.meters % 100 === 0;
  return (
    <div className="b-field">
      <div className="seg" role="radiogroup" aria-label="Mesure du bloc">
        {(['time', 'distance', 'open'] as const).map((k) => (
          <label key={k}>
            <input type="radio" name={`${id}-measure`} checked={m.kind === k}
              onChange={() => onChange(k === 'time' ? { kind: 'time', seconds: 600 } : k === 'distance' ? { kind: 'distance', meters: 1000 } : { kind: 'open' })} />
            {k === 'time' ? 'Durée' : k === 'distance' ? 'Distance' : 'Libre'}
          </label>
        ))}
      </div>
      {m.kind === 'time' ? (
        <span className="b-inline">
          <input aria-label="Minutes" type="number" min={0} max={1440} value={minutes} className="num"
            onChange={(e) => onChange({ kind: 'time', seconds: Math.max(1, (Number(e.target.value) || 0) * 60 + seconds) })} /> min
          <input aria-label="Secondes" type="number" min={0} max={59} step={5} value={seconds} className="num"
            onChange={(e) => onChange({ kind: 'time', seconds: Math.max(1, minutes * 60 + Math.min(59, Number(e.target.value) || 0)) })} /> s
        </span>
      ) : m.kind === 'distance' ? (
        <span className="b-inline">
          <input aria-label="Distance" type="number" min={1} step={km ? 0.1 : 25} value={km ? m.meters / 1000 : m.meters} className="num"
            onChange={(e) => onChange({ kind: 'distance', meters: Math.max(1, Math.round((Number(e.target.value) || 0) * (km ? 1000 : 1))) })} />
          <select aria-label="Unité de distance" value={km ? 'km' : 'm'}
            onChange={(e) => onChange({ kind: 'distance', meters: e.target.value === 'km' ? Math.max(1000, Math.round(m.meters / 1000) * 1000) : m.meters })}>
            <option value="m">m</option><option value="km">km</option>
          </select>
        </span>
      ) : <span className="muted">À la sensation, jusqu’au repère indiqué en note</span>}
    </div>
  );
}

const INTENSITY_KINDS: { k: Intensity['kind']; label: string }[] = [
  { k: 'none', label: 'Sans cible' }, { k: 'zone', label: 'Zone' }, { k: 'pace', label: 'Allure' },
  { k: 'power', label: 'Puissance' }, { k: 'hr', label: 'Fréquence cardiaque' }, { k: 'rpe', label: 'Effort ressenti' },
];

function IntensityEditor({ id, i, sport, onChange }: { id: string; i: Intensity; sport: Sport; onChange: (i: Intensity) => void }) {
  const start = (k: Intensity['kind']): Intensity => {
    switch (k) {
      case 'zone': return { kind: 'zone', zone: 2 };
      case 'pace': return { kind: 'pace', unit: defaultPaceUnit(sport), min: sport === 'swimming' ? 110 : 300, max: null };
      case 'power': return { kind: 'power', unit: 'w', min: 200, max: null };
      case 'hr': return { kind: 'hr', unit: 'bpm', min: 140, max: null };
      case 'rpe': return { kind: 'rpe', min: 5, max: null };
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
          {INTENSITY_KINDS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
        </select>
        {i.kind === 'zone' ? (
          <span className="seg" role="radiogroup" aria-label="Zone">
            {([1, 2, 3, 4, 5] as const).map((z) => (
              <label key={z} title={ZONE_LABELS[z]}><input type="radio" name={`${id}-zone`} checked={i.zone === z} onChange={() => onChange({ kind: 'zone', zone: z })} />Z{z}</label>
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

function StepEditor({ step, sport, index, onChange, tools }: { step: EStep; sport: Sport; index: string; onChange: (s: EStep) => void; tools: React.ReactNode }) {
  const id = useId();
  const [noteOpen, setNoteOpen] = useState(Boolean(step.note));
  const stepSport = step.sport ?? (MULTISPORT.includes(sport) ? null : sport);
  return (
    <div className={`b-step phase-${step.phase}`} role="group" aria-label={`Bloc ${index}`}>
      <div className="b-head">
        <span className="b-index" aria-hidden="true">{index}</span>
        <select aria-label={`Type du bloc ${index}`} value={step.phase} onChange={(e) => onChange({ ...step, phase: e.target.value as Phase })}>
          {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
        </select>
        {MULTISPORT.includes(sport) ? (
          <select aria-label={`Sport du bloc ${index}`} value={step.sport ?? ''} onChange={(e) => onChange({ ...step, sport: (e.target.value || null) as Sport | null })}>
            <option value="">Sport…</option>
            {(MULTI_STEP_SPORTS[sport] ?? SPORTS).map((s) => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
          </select>
        ) : null}
        <span className="b-tools">{tools}</span>
      </div>
      <MeasureEditor id={id} m={step.measure} onChange={(m) => onChange({ ...step, measure: m })} />
      <IntensityEditor id={id} i={step.intensity} sport={stepSport ?? 'running'} onChange={(i) => onChange({ ...step, intensity: i })} />
      {noteOpen ? (
        <div className="b-field">
          <label className="b-label" htmlFor={`${id}-note`}>Note</label>
          <input id={`${id}-note`} maxLength={200} value={step.note ?? ''} placeholder="Par exemple : en côte, pieds rapides, pull-buoy"
            onChange={(e) => onChange({ ...step, note: e.target.value || null })} />
        </div>
      ) : (
        <button type="button" className="link-btn" onClick={() => setNoteOpen(true)}>+ Ajouter une note</button>
      )}
    </div>
  );
}

function Tools({ index, onUp, onDown, onDuplicate, onRemove }: { index: string; onUp?: () => void; onDown?: () => void; onDuplicate: () => void; onRemove: () => void }) {
  return (
    <>
      <button type="button" className="icon-btn" onClick={onUp} disabled={!onUp} aria-label={`Monter le bloc ${index}`}>↑</button>
      <button type="button" className="icon-btn" onClick={onDown} disabled={!onDown} aria-label={`Descendre le bloc ${index}`}>↓</button>
      <button type="button" className="icon-btn" onClick={onDuplicate} aria-label={`Dupliquer le bloc ${index}`}>⧉</button>
      <button type="button" className="icon-btn danger" onClick={onRemove} aria-label={`Supprimer le bloc ${index}`}>✕</button>
    </>
  );
}

function BlockList({ blocks, sport, depth, prefix, onChange }: { blocks: EBlock[]; sport: Sport; depth: number; prefix: string; onChange: (b: EBlock[]) => void }) {
  const update = (k: number, b: EBlock) => onChange(blocks.map((x, i) => (i === k ? b : x)));
  const move = (k: number, d: -1 | 1) => {
    const next = [...blocks];
    const [b] = next.splice(k, 1);
    next.splice(k + d, 0, b!);
    onChange(next);
  };
  return (
    <ol className="b-list">
      {blocks.map((b, k) => {
        const index = prefix ? `${prefix}.${k + 1}` : String(k + 1);
        const tools = (
          <Tools index={index}
            onUp={k > 0 ? () => move(k, -1) : undefined}
            onDown={k < blocks.length - 1 ? () => move(k, 1) : undefined}
            onDuplicate={() => onChange([...blocks.slice(0, k + 1), clone(b), ...blocks.slice(k + 1)])}
            onRemove={() => onChange(blocks.filter((_, i) => i !== k))} />
        );
        return (
          <li key={b._k}>
            {b.type === 'step' ? (
              <StepEditor step={b} sport={sport} index={index} onChange={(s) => update(k, s)} tools={tools} />
            ) : (
              <div className="b-repeat" role="group" aria-label={`Répétition ${index}`}>
                <div className="b-head">
                  <span className="b-index" aria-hidden="true">{index}</span>
                  <label className="b-inline">Répéter
                    <input type="number" className="num" min={2} max={50} value={b.times} aria-label={`Nombre de répétitions du bloc ${index}`}
                      onChange={(e) => update(k, { ...b, times: Math.min(50, Math.max(2, Number(e.target.value) || 2)) })} /> fois
                  </label>
                  <span className="b-tools">{tools}</span>
                </div>
                <BlockList blocks={b.steps} sport={sport} depth={depth + 1} prefix={index} onChange={(steps) => update(k, { ...b, steps })} />
                <div className="actions">
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

/** Constructeur complet, contrôlé par le formulaire de séance. */
export function WorkoutBuilder({ sport, value, onChange }: { sport: Sport; value: EBlock[]; onChange: (b: EBlock[]) => void }) {
  const presets = presetsFor(sport);
  const blocks = fromEditor(value);
  const totals = structureTotals(blocks);
  const defaultSport = MULTISPORT.includes(sport) ? (MULTI_STEP_SPORTS[sport]?.[0] ?? null) : null;
  return (
    <section className="builder" aria-labelledby="builder-title" data-tour="builder">
      <div className="b-title-row">
        <h2 id="builder-title">Déroulé de la séance</h2>
        <p className="muted">Construis la séance bloc par bloc : durée ou distance, intensité, répétitions et séries.</p>
      </div>
      {value.length ? (
        <BlockList blocks={value} sport={sport} depth={0} prefix="" onChange={onChange} />
      ) : (
        <p className="empty b-empty">Aucun bloc pour l’instant. Ajoute une étape, une répétition ou pars d’un modèle.</p>
      )}
      <div className="actions" data-tour="builder-add">
        <button type="button" className="btn" onClick={() => onChange([...value, newStep(value.length ? 'work' : 'warmup', defaultSport)])}>+ Étape</button>
        <button type="button" className="btn" onClick={() => onChange([...value, newRepeat()])}>+ Répétition</button>
        <label className="visually-hidden" htmlFor="preset">Ajouter un modèle</label>
        <select id="preset" className="select" value="" data-tour="presets"
          onChange={(e) => {
            const p = presets.find((x) => x.id === e.target.value);
            if (p) onChange([...value, ...toEditor(p.blocks())]);
          }}>
          <option value="">+ Modèle rapide…</option>
          {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      {value.length ? (
        <div className="b-summary" aria-live="polite">
          <p><strong>Total :</strong> {describeTotals(totals)}
            {totals.unknownTime ? <span className="muted"> · une partie du temps dépend de l’athlète (bloc libre ou distance sans allure)</span> : null}</p>
          <p className="muted" style={{ marginTop: 6 }}>Ce que lira l’athlète :</p>
          <ol className="b-preview">{blocks.map((b, k) => <li key={k}>{describeBlock(b, sport)}</li>)}</ol>
        </div>
      ) : null}
    </section>
  );
}
