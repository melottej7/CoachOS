import { describe, expect, it } from 'vitest';
import { describeBlock, parseWith, PRESETS, structureSchema, structureTotals, workoutInputSchema, type Block } from './index';

const blocks = (input: unknown) => {
  const r = parseWith(structureSchema, input);
  if (!r.ok) throw new Error(JSON.stringify(r.fields));
  return r.value as Block[];
};

describe('séance structurée', () => {
  const session = [
    { type: 'step', phase: 'warmup', measure: { kind: 'time', seconds: 900 }, intensity: { kind: 'zone', zone: 1 } },
    {
      type: 'repeat', times: 3, steps: [
        { type: 'repeat', times: 5, steps: [
          { type: 'step', phase: 'work', measure: { kind: 'distance', meters: 400 }, intensity: { kind: 'pace', unit: 'per_km', min: 210, max: 220 } },
          { type: 'step', phase: 'recovery', measure: { kind: 'distance', meters: 200 }, intensity: { kind: 'zone', zone: 1 } },
        ] },
        { type: 'step', phase: 'rest', measure: { kind: 'time', seconds: 180 } },
      ],
    },
    { type: 'step', phase: 'cooldown', measure: { kind: 'time', seconds: 600 }, intensity: { kind: 'zone', zone: 1 } },
  ];

  it('accepte séries imbriquées, allure en fourchette, phases et intensités variées', () => {
    expect(blocks(session)).toHaveLength(3);
  });

  it('calcule durée et distance, en signalant l’estimation et la part inconnue', () => {
    const t = structureTotals(blocks(session));
    expect(t.meters).toBe(3 * 5 * 600);
    // 900 + 600 + 3 × 180 s mesurés ; 15 × 400 m à 3:35 /km ≈ 86 s chacun estimés ; 200 m sans allure : inconnu
    expect(t.seconds).toBe(900 + 600 + 540 + 15 * 86);
    expect(t.estimated).toBe(true);
    expect(t.unknownTime).toBe(true);
  });

  it('décrit chaque bloc en français lisible', () => {
    const [w, rep] = blocks(session);
    expect(describeBlock(w!)).toBe('Échauffement · 15 min · Z1 (très facile)');
    expect(describeBlock(rep!)).toBe('3 × (5 × (400 m · 3:30 à 3:40 /km / 200 m · Z1 (très facile)) / 3 min)');
  });

  it('refuse imbrication trop profonde, répétition d’une fois, fourchette inversée, unité inconnue', () => {
    const deep = [{ type: 'repeat', times: 2, steps: [{ type: 'repeat', times: 2, steps: [{ type: 'repeat', times: 2, steps: [] }] }] }];
    expect(parseWith(structureSchema, deep).ok).toBe(false);
    expect(parseWith(structureSchema, [{ type: 'repeat', times: 1, steps: [session[0]] }]).ok).toBe(false);
    expect(parseWith(structureSchema, [{ ...session[0], intensity: { kind: 'hr', unit: 'bpm', min: 160, max: 150 } }]).ok).toBe(false);
    expect(parseWith(structureSchema, [{ ...session[0], intensity: { kind: 'power', unit: 'kcal', min: 1 } }]).ok).toBe(false);
    expect(parseWith(structureSchema, [{ ...session[0], extra: true }]).ok).toBe(false);
  });

  it('chaque modèle rapide est valide et passe dans une séance', () => {
    for (const p of PRESETS) {
      const r = parseWith(workoutInputSchema, { localDate: '2026-11-17', timeZone: 'Europe/Brussels', sport: p.sports[0], title: p.label, intervals: p.blocks() });
      expect(r.ok, p.id).toBe(true);
    }
  });
});
