import { describe, expect, it } from 'vitest';
import { sessionProfile, stepLevel } from './session-profile';
import type { Block, Step } from './structure';

const step = (phase: string, measure: object, intensity: object = { kind: 'none' }): Step =>
  ({ type: 'step', phase, sport: null, measure, intensity, cadence: null, note: null }) as unknown as Step;

describe('forme de la séance (D-040)', () => {
  it('déplie les répétitions dans l’ordre, durée et niveau par barre', () => {
    const blocks: Block[] = [
      step('warmup', { kind: 'time', seconds: 900 }, { kind: 'zone', zone: 1 }),
      { type: 'repeat', times: 5, steps: [step('work', { kind: 'distance', meters: 400 }, { kind: 'zone', zone: 5 }), step('recovery', { kind: 'distance', meters: 200 }, { kind: 'zone', zone: 1 })] },
      step('cooldown', { kind: 'time', seconds: 600 }, { kind: 'zone', zone: 1 }),
    ];
    const bars = sessionProfile(blocks, 'running', { vmaKmh: 16 });
    expect(bars).toHaveLength(12);
    expect(bars.map((b) => b.level)).toEqual([1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 1]);
    expect(bars[1]).toMatchObject({ phase: 'work', repeat: 'répétition 1 sur 5', secondsApprox: false });
    expect(bars[9]!.repeat).toBe('répétition 5 sur 5');
    const nested = sessionProfile([{ type: 'repeat', times: 2, steps: [{ type: 'repeat', times: 3, steps: [step('work', { kind: 'time', seconds: 30 })] }, step('rest', { kind: 'time', seconds: 120 })] }], 'running');
    expect(nested.map((b) => b.repeat)).toEqual(['série 1 sur 2 · répétition 1 sur 3', 'série 1 sur 2 · répétition 2 sur 3', 'série 1 sur 2 · répétition 3 sur 3', 'série 1 sur 2', 'série 2 sur 2 · répétition 1 sur 3', 'série 2 sur 2 · répétition 2 sur 3', 'série 2 sur 2 · répétition 3 sur 3', 'série 2 sur 2']);
    // 400 m en Z5 avec une VMA de 16 : 92,5 % → 14,8 km/h → environ 97 s.
    expect(bars[1]!.seconds).toBeGreaterThan(90);
    expect(bars[1]!.seconds).toBeLessThan(105);
  });

  it('sans VMA, la distance est dessinée avec une durée supposée et signalée', () => {
    const bars = sessionProfile([step('work', { kind: 'distance', meters: 1000 }, { kind: 'zone', zone: 4 })], 'running');
    expect(bars[0]).toMatchObject({ seconds: 360, secondsApprox: true, level: 4, levelKnown: true });
  });

  it('niveau depuis l’effort, la FC, la puissance, ou supposé d’après la phase', () => {
    expect(stepLevel(step('work', { kind: 'time', seconds: 60 }, { kind: 'rpe', min: 9, max: null }), 'running').level).toBe(6);
    expect(stepLevel(step('work', { kind: 'time', seconds: 60 }, { kind: 'hr', unit: 'pct_max', min: 88, max: 90 }), 'running').level).toBe(5);
    expect(stepLevel(step('work', { kind: 'time', seconds: 60 }, { kind: 'power', unit: 'pct_ftp', min: 95, max: 100 }), 'cycling').level).toBe(4);
    expect(stepLevel(step('work', { kind: 'time', seconds: 60 }, { kind: 'pace', unit: 'per_km', min: 240, max: null }), 'running', { vmaKmh: 16 })).toEqual({ level: 5, known: true }); // 94 % de VMA
    expect(stepLevel(step('work', { kind: 'time', seconds: 60 }, { kind: 'pace', unit: 'per_km', min: 220, max: null }), 'running', { vmaKmh: 16 }).level).toBe(7); // 102 %
    expect(stepLevel(step('recovery', { kind: 'open' }), 'running')).toEqual({ level: 1, known: false });
  });
});
