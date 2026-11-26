import { describe, expect, it } from 'vitest';
import { followExercises, followSequence } from './exercises';
import { fitSteps } from './fit';
import { announce } from './follow-voice';
import { parseNotation, toNotation } from './notation';
import { strengthPlan } from './strength-log';
import { describeBlock, REP_SECONDS, structureSchema, structureTotals, type Block } from './structure';

// D-184 · Séries différentes dans une carte d’exercice : la charge et les répétitions changent d’une série à l’autre.

const tirage = (perSet: { reps: number | null; kg: number | null }[] | null, times = 3): Block => ({
  type: 'repeat', times, steps: [
    { type: 'step', phase: 'work', sport: null, measure: { kind: 'reps', reps: 12 }, intensity: { kind: 'load', min: 10, max: null }, cadence: null, note: null, exercise: { id: null, name: 'Tirer latéral' }, perSet },
    { type: 'step', phase: 'rest', sport: null, measure: { kind: 'time', seconds: 90 }, intensity: { kind: 'none' }, cadence: null, note: null },
  ],
});
const pyramide = [{ reps: 12, kg: 10 }, { reps: 10, kg: 12 }, { reps: 8, kg: 14 }];

describe('séries différentes (D-184)', () => {
  it('se lisent, s’enchaînent et se notent série par série', () => {
    const blocks = structureSchema.parse([tirage(pyramide)]) as Block[];
    expect(describeBlock(blocks[0]!, 'strength')).toBe('3 × (Tirer latéral · 12 × 10 kg, 10 × 12 kg, 8 × 14 kg / repos 1 min 30 s)');
    const seq = followSequence(blocks);
    const work = seq.filter((f) => f.step.phase === 'work');
    expect(work.map((f) => [f.step.measure, f.step.intensity])).toEqual([
      [{ kind: 'reps', reps: 12 }, { kind: 'load', min: 10, max: null }],
      [{ kind: 'reps', reps: 10 }, { kind: 'load', min: 12, max: null }],
      [{ kind: 'reps', reps: 8 }, { kind: 'load', min: 14, max: null }],
    ]);
    expect(work.every((f) => !('perSet' in f.step))).toBe(true);
    expect(announce(work[1]!, seq[work[1]!.index + 1] ?? null)).toBe('Série 2 sur 3. Tirer latéral. 10 répétitions. 12 kilos.');
    const restBefore2 = seq[work[1]!.index - 1]!;
    expect(announce(restBefore2, work[1]!, work[0]!)).toBe('Récupération, 1 minute 30. Ensuite : Tirer latéral. Prépare 12 kilos.');
    expect(strengthPlan(blocks)[0]!.sets.map(({ reps, kg }) => [reps, kg])).toEqual([[12, 10], [10, 12], [8, 14]]);
    expect(followExercises(seq)[0]!.summary).toBe('3 séries · 12 × 10 kg, 10 × 12 kg, 8 × 14 kg · repos 1 min 30 s');
    expect(structureTotals(blocks).seconds).toBe((12 + 10 + 8) * REP_SECONDS + 3 * 90);
  });

  it('suivent le nombre de séries et disparaissent quand rien ne peut varier', () => {
    const four = structureSchema.parse([tirage(pyramide, 4)]) as Block[];
    expect((four[0] as { steps: { perSet?: unknown[] }[] }).steps[0]!.perSet).toEqual([...pyramide, pyramide[2]]);
    const two = structureSchema.parse([tirage(pyramide, 2)]) as Block[];
    expect((two[0] as { steps: { perSet?: unknown[] }[] }).steps[0]!.perSet).toEqual(pyramide.slice(0, 2));
    const timed = tirage(pyramide) as { steps: Record<string, unknown>[] };
    timed.steps[0] = { ...timed.steps[0], measure: { kind: 'time', seconds: 30 }, intensity: { kind: 'none' } };
    expect((structureSchema.parse([timed]) as { steps: { perSet?: unknown }[] }[])[0]!.steps[0]!.perSet).toBeUndefined();
  });

  it('s’écrivent et se relisent en texte : « 3×12/10/8 Tirer latéral 10/12/14kg R1\'30 »', () => {
    const parsed = parseNotation("3×12/10/8 Tirer latéral 10/12/14kg R1'30", 'strength');
    expect(parsed.errors).toEqual([]);
    expect(describeBlock(parsed.blocks[0]!, 'strength')).toBe('3 × (Tirer latéral · 12 × 10 kg, 10 × 12 kg, 8 × 14 kg / récup 1 min 30 s)');
    const blocks = structureSchema.parse([tirage(pyramide)]) as Block[];
    const text = toNotation(blocks, 'strength');
    expect(text).toContain('12/10/8 Tirer latéral 10/12/14kg');
    expect(describeBlock(parseNotation(text, 'strength').blocks[0]!, 'strength')).toBe(describeBlock(blocks[0]!, 'strength'));
    // Charge seule qui monte, demi-kilos compris.
    const kg = parseNotation('3×10 Squat goblet 12,5/15/17,5kg', 'strength');
    expect(describeBlock(kg.blocks[0]!, 'strength')).toBe('3 × (Squat goblet · 10 × 12,5 kg, 10 × 15 kg, 10 × 17,5 kg)');
  });

  it('partent vers la montre série par série', () => {
    const steps = fitSteps(structureSchema.parse([tirage(pyramide)]) as Block[], 'strength');
    expect(steps.filter((s) => s.name.startsWith('Répéter'))).toHaveLength(0);
    expect(steps.filter((s) => s.durationType === 29).map((s) => s.durationValue)).toEqual([12, 10, 8]);
  });
});
