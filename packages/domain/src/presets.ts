import type { Sport } from './sports';
import type { Block, Intensity, Phase, Step } from './structure';

// Modèles rapides (D-023) : points de départ que le coach ajuste. Insérés à la suite des blocs existants.

const step = (phase: Phase, measure: Step['measure'], intensity: Intensity = { kind: 'none' }, extra: Partial<Step> = {}): Step => ({
  type: 'step', phase, sport: null, measure, intensity, cadence: null, note: null, ...extra,
});
const min = (n: number): Step['measure'] => ({ kind: 'time', seconds: n * 60 });
const sec = (n: number): Step['measure'] => ({ kind: 'time', seconds: n });
const m = (n: number): Step['measure'] => ({ kind: 'distance', meters: n });
const z = (zone: number): Intensity => ({ kind: 'zone', zone });
const rpe = (v: number): Intensity => ({ kind: 'rpe', min: v, max: null });

export interface Preset {
  id: string;
  label: string;
  sports: Sport[];
  blocks: () => Block[];
}

const RUN: Sport[] = ['running', 'trail', 'triathlon', 'duathlon'];
const BIKE: Sport[] = ['cycling', 'triathlon', 'duathlon'];
const SWIM: Sport[] = ['swimming', 'triathlon'];
const ALL: Sport[] = ['running', 'trail', 'cycling', 'swimming', 'triathlon', 'duathlon'];

export const PRESETS: Preset[] = [
  { id: 'warmup', label: 'Échauffement 15 min', sports: ALL, blocks: () => [step('warmup', min(15), z(1))] },
  { id: 'cooldown', label: 'Retour au calme 10 min', sports: ALL, blocks: () => [step('cooldown', min(10), z(1))] },
  { id: 'endurance', label: 'Endurance 45 min', sports: ALL, blocks: () => [step('work', min(45), z(2))] },
  {
    id: 'short-intervals', label: 'Fractionné court 10 × 400 m', sports: RUN,
    blocks: () => [{ type: 'repeat', times: 10, steps: [step('work', m(400), z(5)), step('recovery', m(200), z(1), { note: 'trot' })] }],
  },
  {
    id: 'long-intervals', label: 'Fractionné long 4 × 1000 m', sports: RUN,
    blocks: () => [{ type: 'repeat', times: 4, steps: [step('work', m(1000), z(4)), step('recovery', min(2), z(1))] }],
  },
  {
    id: 'sets', label: 'Séries 3 × (5 × 300 m)', sports: RUN,
    blocks: () => [{
      type: 'repeat', times: 3,
      steps: [{ type: 'repeat', times: 5, steps: [step('work', m(300), z(5)), step('recovery', sec(60), z(1))] }, step('rest', min(3), { kind: 'none' }, { note: 'entre les séries' })],
    }],
  },
  { id: 'tempo', label: 'Tempo 20 min', sports: RUN, blocks: () => [step('work', min(20), z(3))] },
  {
    id: 'hills', label: 'Côtes 8 × 1 min', sports: ['running', 'trail'],
    blocks: () => [{ type: 'repeat', times: 8, steps: [step('work', min(1), rpe(8), { note: 'en côte' }), step('recovery', open(), z(1), { note: 'descente en trottinant' })] }],
  },
  { id: 'long-run', label: 'Sortie longue 1 h 30', sports: ['running', 'trail'], blocks: () => [step('work', min(90), z(2))] },
  {
    id: 'sweet-spot', label: 'Vélo 3 × 10 min seuil', sports: BIKE,
    blocks: () => [{ type: 'repeat', times: 3, steps: [step('work', min(10), { kind: 'power', unit: 'pct_ftp', min: 88, max: 94 }), step('recovery', min(5), z(1))] }],
  },
  {
    id: 'sprints', label: 'Vélo sprints 6 × 30 s', sports: BIKE,
    blocks: () => [{ type: 'repeat', times: 6, steps: [step('work', sec(30), rpe(9)), step('recovery', sec(270), z(1))] }],
  },
  {
    id: 'swim-100', label: 'Natation 10 × 100 m', sports: SWIM,
    blocks: () => [
      step('warmup', m(400), z(1)),
      { type: 'repeat', times: 10, steps: [step('work', m(100), z(4)), step('rest', sec(20))] },
      step('cooldown', m(200), z(1)),
    ],
  },
  {
    id: 'brick', label: 'Enchaînement vélo + course', sports: ['triathlon', 'duathlon'],
    blocks: () => [step('work', min(60), z(2), { sport: 'cycling' }), step('work', min(20), z(3), { sport: 'running', note: 'enchaîné, sans pause' })],
  },
];

function open(): Step['measure'] {
  return { kind: 'open' };
}

export function presetsFor(sport: Sport): Preset[] {
  return PRESETS.filter((p) => p.sports.includes(sport));
}
