import { describe, expect, it } from 'vitest';
import {
  adjustForChanges, applyFollowLog, asDone, describeFollowChanges, followExercises, followSequence, nextOpenPart, parseNotation, strengthPlan, swapKey, swappableNames, withSwaps,
} from './index';

// D-182 · Machines prises : un autre ordre, un remplacement, un exercice en plus ; le retour le reprend.
const blocks = parseNotation("3×(10 presse a cuisses 60kg + repos 1'30) + 3×(12 tirage vertical 40kg + repos 1'30) + 3×(10 leg curl 30kg + repos 1')", 'strength').blocks;
const seq = followSequence(blocks);
const parts = followExercises(seq);

describe('suivre la séance dans un autre ordre (D-182)', () => {
  it('trois exercices, trois parties', () => {
    expect(parts.map((p) => p.name)).toEqual(['Presse a cuisses', 'Tirage vertical', 'Leg curl']);
  });

  it('après un exercice pris en avance, on revient à celui laissé en arrière', () => {
    // Presse prise : l’élève commence par le tirage (1), puis vient le leg curl (2), puis la presse (0).
    expect(nextOpenPart(3, new Set([1]), 1)).toBe(2);
    expect(nextOpenPart(3, new Set([1, 2]), 2)).toBe(0);
    expect(nextOpenPart(3, new Set([0, 1, 2]), 0)).toBeNull();
    // Ordre normal inchangé.
    expect(nextOpenPart(3, new Set([0]), 0)).toBe(1);
  });

  it('un remplacement change le nom affiché de toutes les séries de la partie, pas ailleurs', () => {
    expect(swappableNames(seq, parts[0]!)).toEqual(['Presse a cuisses']);
    const swaps = { [swapKey(0, 'Presse a cuisses')]: { name: 'Hack squat', exerciseId: null, starterKey: null, from: 'Presse a cuisses' } };
    const shown = withSwaps(seq, parts, swaps);
    expect(followExercises(shown).map((p) => p.name)).toEqual(['Hack squat', 'Tirage vertical', 'Leg curl']);
    expect(shown.filter((f) => f.step.exercise?.name === 'Hack squat')).toHaveLength(3);
  });

  it('le retour : séries reportées sur le remplaçant, exercice passé à 0, ajout à la fin, phrase pour le coach', () => {
    const plan = strengthPlan(blocks);
    const done = applyFollowLog(plan, { [seq.find((f) => f.step.exercise?.name === 'Presse a cuisses')!.index]: { reps: 10, kg: 70 } });
    const changes = {
      skippedParts: [2],
      swaps: { [swapKey(0, 'Presse a cuisses')]: { name: 'Hack squat', exerciseId: null, starterKey: null, from: 'Presse a cuisses' } },
      extras: [{ name: 'Gainage', exerciseId: null, starterKey: null, sets: 3, reps: 20, kg: null }],
    };
    const out = adjustForChanges(blocks, plan, done, changes);
    expect(out.map((e) => e.name)).toEqual(['Hack squat', 'Tirage vertical', 'Leg curl', 'Gainage']);
    expect(out[0]!.sets[0]).toEqual({ reps: 10, kg: 70, seconds: null }); // noté pendant la séance, gardé
    expect(out[2]!.sets.every((x) => x.reps === 0)).toBe(true);
    expect(out[3]!.sets).toHaveLength(3);
    expect(describeFollowChanges(parts, changes)).toBe('Changements à la salle — remplacé : Presse a cuisses → Hack squat ; pas fait : Leg curl ; en plus : Gainage (3 × 20).');
    // Sans changement, rien ne bouge.
    expect(adjustForChanges(blocks, plan, asDone(plan), { skippedParts: [], swaps: {}, extras: [] })).toEqual(asDone(plan));
  });
});
