import { describe, expect, it } from 'vitest';
import { followSequence } from './exercises';
import { fitSteps } from './fit';
import { sessionView } from './session-view';
import { strengthPlan } from './strength-log';
import { describeBlock, structureSchema, structureTotals, type Block, type Stage } from './structure';
import { toNotation } from './notation';

// D-164 · Cardio sur machine en paliers (exemple du fondateur : 5 min niveau 1, 7 min niveau 2, 5 min niveau 3, 2 min niveau 1).

const stage = (minutes: number, extra: Partial<Stage> = {}): Stage => ({
  seconds: minutes * 60, level: null, speedKmh: null, inclinePct: null, cadence: null, watts: null, split500: null, rpe: null, note: null, ...extra,
});
const elliptique: Block = {
  type: 'step', phase: 'warmup', sport: null, measure: { kind: 'time', seconds: 19 * 60 }, intensity: { kind: 'none' }, cadence: null, note: null,
  exercise: null,
  cardio: { machine: 'elliptical', stages: [stage(5, { level: 1 }), stage(7, { level: 2 }), stage(5, { level: 3 }), stage(2, { level: 1 })] },
};
const tapis: Block = {
  type: 'step', phase: 'cooldown', sport: null, measure: { kind: 'time', seconds: 20 * 60 }, intensity: { kind: 'none' }, cadence: null, note: null,
  exercise: { id: null, name: 'Marche rapide' },
  cardio: { machine: 'treadmill', stages: [stage(5, { speedKmh: 4.5 }), stage(10, { speedKmh: 6, inclinePct: 5 }), stage(5, { speedKmh: 4.5 })] },
};
const squat: Block = {
  type: 'repeat', times: 3, steps: [
    { type: 'step', phase: 'work', sport: null, measure: { kind: 'reps', reps: 10 }, intensity: { kind: 'load', min: 20, max: null }, cadence: null, note: null, exercise: { id: null, name: 'Squat' } },
    { type: 'step', phase: 'rest', sport: null, measure: { kind: 'time', seconds: 60 }, intensity: { kind: 'none' }, cadence: null, note: null },
  ],
};
const rameur: Block = {
  type: 'repeat', times: 4, steps: [
    { type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: 120 }, intensity: { kind: 'none' }, cadence: null, note: null, exercise: null,
      cardio: { machine: 'rower', stages: [stage(2, { split500: 125, cadence: 26 })] } },
    { type: 'step', phase: 'rest', sport: null, measure: { kind: 'time', seconds: 60 }, intensity: { kind: 'none' }, cadence: null, note: null },
  ],
};
const program = [elliptique, squat, rameur, tapis];

describe('cardio sur machine en paliers (D-164)', () => {
  it('le schéma accepte un programme complet et garde les séances existantes telles quelles', () => {
    const r = structureSchema.safeParse(program);
    expect(r.success).toBe(true);
    expect(structureSchema.safeParse([squat]).success).toBe(true);
  });

  it('refuse une durée qui ne fait pas la somme des paliers, un réglage inconnu ou hors bornes', () => {
    expect(structureSchema.safeParse([{ ...elliptique, measure: { kind: 'time', seconds: 20 * 60 } }]).success).toBe(false);
    expect(structureSchema.safeParse([{ ...elliptique, cardio: { machine: 'elliptical', stages: [{ ...stage(5), resistance: 3 }] } }]).success).toBe(false);
    expect(structureSchema.safeParse([{ ...elliptique, measure: { kind: 'time', seconds: 300 }, cardio: { machine: 'elliptical', stages: [stage(5, { level: 99 })] } }]).success).toBe(false);
    expect(structureSchema.safeParse([{ ...elliptique, cardio: { machine: 'elliptical', stages: [] } }]).success).toBe(false);
  });

  it('se lit comme le coach l’a pensé', () => {
    expect(describeBlock(elliptique)).toBe('Vélo elliptique · 19 min : 5 min · niveau 1, 7 min · niveau 2, 5 min · niveau 3, 2 min · niveau 1');
    expect(describeBlock(tapis)).toBe('Marche rapide · 20 min : 5 min · 4,5 km/h, 10 min · 6 km/h · pente 5 %, 5 min · 4,5 km/h');
    expect(describeBlock(rameur)).toBe('4 × (Rameur · 2 min · 26 coups/min · 2:05 /500 m / repos 1 min)');
  });

  it('durées justes, distance du tapis estimée d’après ses vitesses', () => {
    const t = structureTotals(program, { sport: 'strength' });
    expect(t.seconds).toBe(19 * 60 + 3 * (10 * 4 + 60) + 4 * 180 + 20 * 60);
    expect(t.totalMeters).toBe(Math.round(((300 * 4.5 + 600 * 6 + 300 * 4.5) / 3.6) / 10) * 10);
  });

  it('chaque cardio est une ligne avec ses paliers', () => {
    const v = sessionView(program, 'strength');
    expect(v.rows[0]).toMatchObject({ title: 'Vélo elliptique', detail: '19 min · 4 paliers', stages: ['5 min · niveau 1', '7 min · niveau 2', '5 min · niveau 3', '2 min · niveau 1'] });
    expect(v.rows[2]).toMatchObject({ title: 'Rameur', badge: '4×' });
    expect(v.rows[3]!.title).toBe('Marche rapide');
    expect(v.minutes).toBe(Math.round(structureTotals(program).seconds / 60));
  });

  it('suivi pas à pas : un écran et un chrono par palier ; le cardio ne va pas dans le carnet de séries', () => {
    const seq = followSequence(program);
    const first = seq.slice(0, 4);
    expect(first.map((f) => f.stage)).toEqual([
      { k: 1, n: 4, name: 'Vélo elliptique', settings: 'niveau 1' }, { k: 2, n: 4, name: 'Vélo elliptique', settings: 'niveau 2' },
      { k: 3, n: 4, name: 'Vélo elliptique', settings: 'niveau 3' }, { k: 4, n: 4, name: 'Vélo elliptique', settings: 'niveau 1' },
    ]);
    expect(first.map((f) => f.step.measure)).toEqual([300, 420, 300, 120].map((seconds) => ({ kind: 'time', seconds })));
    expect(strengthPlan(program).map((e) => e.name)).toEqual(['Squat']);
  });

  it('montre : un pas par palier, la cadence en cible, les autres réglages en note', () => {
    const f = fitSteps([elliptique, rameur], 'strength');
    expect(f.slice(0, 4).map((x) => [x.name, x.durationValue, x.notes])).toEqual([
      ['Vélo elliptique', 300_000, 'niveau 1'], ['Vélo elliptique', 420_000, 'niveau 2'], ['Vélo elliptique', 300_000, 'niveau 3'], ['Vélo elliptique', 120_000, 'niveau 1'],
    ]);
    expect(f[4]).toMatchObject({ name: 'Rameur', durationValue: 120_000, low: 26, high: 26, notes: '2:05 /500 m' });
  });

  it('notation rapide : le cardio s’écrit par sa durée et son nom', () => {
    expect(toNotation([elliptique], 'strength')).toContain('Vélo elliptique');
  });
});
