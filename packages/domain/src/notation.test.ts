import { describe, expect, it } from 'vitest';
import { parseNotation, toNotation } from './notation';
import { structureSchema } from './structure';

describe('notation texte (D-041)', () => {
  it('lit une séance de fractionné, phases déduites', () => {
    const { blocks, errors } = parseNotation("15' Z1 + 8×(400m Z5 + R200m) + 10' Z1", 'running');
    expect(errors).toEqual([]);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'step', phase: 'warmup', measure: { kind: 'time', seconds: 900 }, intensity: { kind: 'zone', zone: 1 } });
    expect(blocks[1]).toMatchObject({ type: 'repeat', times: 8 });
    const rep = blocks[1] as Extract<(typeof blocks)[number], { type: 'repeat' }>;
    expect(rep.steps[0]).toMatchObject({ phase: 'work', measure: { kind: 'distance', meters: 400 }, intensity: { kind: 'zone', zone: 5 } });
    expect(rep.steps[1]).toMatchObject({ phase: 'recovery', measure: { kind: 'distance', meters: 200 }, intensity: { kind: 'none' } });
    expect(blocks[2]).toMatchObject({ phase: 'cooldown', measure: { kind: 'time', seconds: 600 } });
    expect(structureSchema.safeParse(blocks).success).toBe(true);
  });

  it('durées, distances, allures, puissance, FC, effort, note et multisport', () => {
    const { blocks, errors } = parseNotation("vélo 1h30 75%FTP + course 1'30 @4'30-4'15/km + 45\" RPE8 + 1,5km 150-160bpm « au train » + libre 70%FC", 'triathlon');
    expect(errors).toEqual([]);
    expect(blocks.map((b) => b.type === 'step' && b.measure)).toEqual([
      { kind: 'time', seconds: 5400 }, { kind: 'time', seconds: 90 }, { kind: 'time', seconds: 45 }, { kind: 'distance', meters: 1500 }, { kind: 'open' },
    ]);
    expect(blocks.map((b) => b.type === 'step' && b.intensity)).toEqual([
      { kind: 'power', unit: 'pct_ftp', min: 75, max: null },
      { kind: 'pace', unit: 'per_km', min: 255, max: 270 },
      { kind: 'rpe', min: 8, max: null },
      { kind: 'hr', unit: 'bpm', min: 150, max: 160 },
      { kind: 'hr', unit: 'pct_max', min: 70, max: null },
    ]);
    expect(blocks[0]).toMatchObject({ sport: 'cycling' });
    expect(blocks[1]).toMatchObject({ sport: 'running' });
    expect(blocks[3]).toMatchObject({ note: 'au train' });
    expect(structureSchema.safeParse(blocks).success).toBe(true);
  });

  it('signale les erreurs au lieu de deviner', () => {
    expect(parseNotation("15' Z1 + + 10'", 'running').errors[0]!.message).toMatch(/vide/);
    expect(parseNotation("8×(400m Z5 + R200m", 'running').errors[0]!.message).toMatch(/Parenthèses/);
    expect(parseNotation('Z5 400m', 'running').errors[0]!.message).toMatch(/durée ou distance attendue/);
    expect(parseNotation("400m Z5 vite", 'running').errors[0]!.message).toMatch(/« vite » non compris/);
    expect(parseNotation("60×200m", 'running').errors[0]!.message).toMatch(/2 à 50/);
    expect(parseNotation("2×(3×(2×200m))", 'running').errors[0]!.message).toMatch(/pas davantage/);
  });

  it('aller-retour : blocs → texte → mêmes blocs', () => {
    const samples = [
      "15' Z1 + 8×(400m Z5 + R200m) + 10' Z1",
      "20' Z2 + 3×(5×(300m Z6 + R1'30) + repos 3') + 10' Z1",
      "45' Z2",
      "échauffement 10' Z3 + 30' Z2",
      "vélo 1h Z2 + course 20' Z3",
      "1,5km @4'30-4'15/km + 2×1000m @3'50/km « régulier »",
    ];
    for (const text of samples) {
      const a = parseNotation(text, 'triathlon');
      expect(a.errors).toEqual([]);
      const back = toNotation(a.blocks, 'triathlon');
      const b = parseNotation(back, 'triathlon');
      expect(b.errors).toEqual([]);
      expect(b.blocks).toEqual(a.blocks);
    }
    expect(toNotation(parseNotation("15' Z1 + 8×(400m Z5 + R200m) + 10' Z1", 'running').blocks, 'running')).toBe("15' Z1 + 8×(400m Z5 + R200m) + 10' Z1");
  });
});
