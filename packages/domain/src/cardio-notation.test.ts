import { describe, expect, it } from 'vitest';
import { checkDictation } from './ai-dictation';
import { parseNotation, toNotation } from './notation';
import type { Step } from './structure';

const first = (text: string, sport: 'strength' | 'running' = 'strength') => {
  const r = parseNotation(text, sport);
  expect(r.errors).toEqual([]);
  return r.blocks[0] as Step;
};

describe('D-196 · cardio sur machine dans une séance de musculation', () => {
  it('« échauffement 10\' vélo RPE3 » : une étape de cardio, pas un exercice', () => {
    const s = first("échauffement 10' vélo RPE3");
    expect(s.phase).toBe('warmup');
    expect(s.exercise ?? null).toBeNull();
    expect(s.cardio).toEqual({ machine: 'bike', stages: [expect.objectContaining({ seconds: 600, rpe: 3 })] });
    expect(s.measure).toEqual({ kind: 'time', seconds: 600 });
    expect(s.intensity).toEqual({ kind: 'none' });
  });

  it('la marche en tête de séance devient l’échauffement sur le tapis', () => {
    const r = parseNotation("10' marche + 4×10 presse à cuisses 60kg R2'", 'strength');
    expect(r.errors).toEqual([]);
    const s = r.blocks[0] as Step;
    expect(s.phase).toBe('warmup');
    expect(s.cardio?.machine).toBe('treadmill');
    expect(s.exercise ?? null).toBeNull();
  });

  it('les réglages de la machine sont lus', () => {
    expect(first("10' tapis 6,5km/h 5% RPE3").cardio?.stages[0]).toMatchObject({ speedKmh: 6.5, inclinePct: 5, rpe: 3 });
    expect(first("8' elliptique niveau 6").cardio).toMatchObject({ machine: 'elliptical', stages: [{ level: 6 }] });
    expect(first("12' rameur 2'10/500m").cardio).toMatchObject({ machine: 'rower', stages: [{ split500: 130 }] });
    expect(first("vélo 10' 90rpm 120W").cardio).toMatchObject({ machine: 'bike', stages: [{ cadence: 90, watts: 120 }] });
    expect(first("5' marche rapide sur tapis").cardio?.machine).toBe('treadmill');
    expect(first("5' marche rapide sur tapis").note).toBe('marche rapide');
    expect(first("10' vélo Z2").note).toBe('Z2');
  });

  it('en fin de séance, facile : le retour au calme ; intense : l’effort', () => {
    const calm = parseNotation("3×10 squat 40kg R1'30 + 5' vélo RPE2", 'strength').blocks;
    expect((calm[1] as Step).phase).toBe('cooldown');
    const hard = parseNotation("3×10 squat 40kg R1'30 + 10' rameur RPE8", 'strength').blocks;
    expect((hard[1] as Step).phase).toBe('work');
  });

  it('un nom d’exercice qui contient une machine reste un exercice', () => {
    expect(first('30" crunch vélo').exercise?.name).toBe('Crunch vélo');
    expect(first('45" marche du fermier 20kg').exercise?.name).toBe('Marche du fermier');
    expect(first('3×12 tirage rameur 30kg').type).toBe('repeat');
  });

  it('hors musculation, rien ne change', () => {
    const r = parseNotation("vélo 1h Z2 + course 20' Z3", 'running');
    expect(r.errors).toEqual([]);
    expect((r.blocks[0] as Step).sport).toBe('cycling');
    expect((r.blocks[0] as Step).cardio ?? null).toBeNull();
  });

  it('écrit puis relu : la machine et ses réglages tiennent', () => {
    const blocks = parseNotation("échauffement 10' tapis 6km/h 5% + 4×10 presse 60kg R2' + calme 5' vélo RPE2", 'strength').blocks;
    const text = toNotation(blocks, 'strength');
    expect(text).toContain("10' Tapis de course 6km/h 5%");
    expect(parseNotation(text, 'strength').blocks).toEqual(blocks);
  });

  it('une séance dictée ligne par ligne garde l’échauffement sur machine', () => {
    const c = checkDictation(["échauffement 10' vélo RPE3", "4×10 presse à cuisses 60kg R2'"], 'strength');
    expect(c.lines.every((l) => !l.error)).toBe(true);
    expect((c.blocks[0] as Step).cardio?.machine).toBe('bike');
    expect((c.blocks[0] as Step).phase).toBe('warmup');
  });
});

describe('D-196 · séance dictée sans le mot « échauffement »', () => {
  it('« 10\' vélo » sur la première ligne devient l’échauffement, comme à l’enregistrement', () => {
    const c = checkDictation(["10' vélo RPE3", "4×10 presse à cuisses 60kg R2'"], 'strength');
    expect((c.blocks[0] as Step).phase).toBe('warmup');
    expect(parseNotation(c.notation, 'strength').blocks).toEqual(c.blocks);
  });
});

describe('D-196 · « Suivre la séance » annonce l’échauffement et le retour au calme', () => {
  it('le cardio en tête est l’échauffement, en fin le retour au calme ; les exercices sont comptés à part', async () => {
    const { followExercises, followSequence } = await import('./exercises');
    const { announceExercise } = await import('./follow-voice');
    const blocks = parseNotation("10' marche + 3×10 squat 40kg R1'30 + 5' vélo RPE2", 'strength').blocks;
    const parts = followExercises(followSequence(blocks));
    expect(parts.map((p) => p.phase)).toEqual(['warmup', null, 'cooldown']);
    expect(announceExercise(parts[0]!, 1, 1, false)).toMatch(/^Échauffement : Tapis de course\./);
    expect(announceExercise(parts[2]!, 1, 1, true)).toMatch(/Retour au calme : Vélo d’appartement\./);
  });
});

describe('D-196 · fiche de la séance', () => {
  it('le cardio dit son rôle et ne compte pas parmi les exercices', async () => {
    const { sessionView } = await import('./session-view');
    const v = sessionView(parseNotation("10' marche + 3×10 squat 40kg R1'30 + 5' vélo RPE2", 'strength').blocks, 'strength');
    expect(v.exercises).toBe(1);
    expect(v.rows[0]).toMatchObject({ title: 'Tapis de course', detail: expect.stringMatching(/^Échauffement · 10/) });
    expect(v.rows[2]!.detail).toMatch(/^Retour au calme · 5/);
  });
});
