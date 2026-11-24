import { describe, expect, it } from 'vitest';
import { followSequence } from './exercises';
import { announce, formatElapsed, reminderAt, spoken } from './follow-voice';
import type { Block } from './structure';

// D-166 · Annonces vocales de « Suivre la séance ».

const planche: Block = {
  type: 'repeat', times: 6, steps: [
    { type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: 20 }, intensity: { kind: 'none' }, cadence: null, note: null, exercise: { id: null, name: 'Planche' } },
    { type: 'step', phase: 'rest', sport: null, measure: { kind: 'time', seconds: 40 }, intensity: { kind: 'none' }, cadence: null, note: null },
  ],
};
const squat: Block = { type: 'step', phase: 'work', sport: null, measure: { kind: 'reps', reps: 10 }, intensity: { kind: 'load', min: 16, max: null }, cadence: null, note: null, exercise: { id: null, name: 'Squat goblet' } };
const elliptique: Block = {
  type: 'step', phase: 'warmup', sport: null, measure: { kind: 'time', seconds: 720 }, intensity: { kind: 'none' }, cadence: null, note: null,
  cardio: { machine: 'elliptical', stages: [
    { seconds: 300, level: 1, speedKmh: null, inclinePct: null, cadence: 60, watts: null, split500: null, rpe: null, note: null },
    { seconds: 420, level: 2, speedKmh: null, inclinePct: null, cadence: null, watts: null, split500: null, rpe: null, note: null },
  ] },
};

describe('annonces vocales (D-166)', () => {
  it('chaque étape en une phrase, unités en toutes lettres', () => {
    const seq = followSequence([elliptique, planche, squat]);
    expect(announce(seq[0]!, seq[1]!)).toBe('Palier 1 sur 2. niveau 1, 60 tours minute. 5 minutes.');
    expect(announce(seq[2]!, seq[3]!)).toBe('Série 1 sur 6. Planche. 20 secondes.');
    expect(announce(seq[3]!, seq[4]!)).toBe('Récupération, 40 secondes. Ensuite : Planche.');
    expect(announce(seq[seq.length - 1]!, null)).toBe('Squat goblet. 10 répétitions. 16 kilos.');
  });

  it('unités courantes', () => {
    expect(spoken('1 min 30 s · 6 km/h · pente 5 % · 2:05 /500 m · Effort 7/10 · 250 W · Z2')).toBe(
      '1 minute 30, 6 kilomètres heure, pente 5 pour cent, 2 minutes 05 au 500 mètres, Effort 7 sur 10, 250 watts, zone 2',
    );
    expect(spoken('1 h 05 · 400 m · 12,5 kg')).toBe('1 heure 5, 400 mètres, 12,5 kilos');
  });

  it('rappels et temps écoulé', () => {
    expect(reminderAt(300, 60)).toBe('Encore 1 minute.');
    expect(reminderAt(120, 60)).toBeNull();
    expect(reminderAt(40, 10)).toBe('Encore 10 secondes.');
    expect(reminderAt(20, 10)).toBeNull();
    expect(formatElapsed(247_000)).toBe('4:07');
    expect(formatElapsed(3_750_000)).toBe('1:02:30');
  });
});
