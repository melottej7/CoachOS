import { describe, expect, it } from 'vitest';
import {
  alternativeName, CHAIN_NUMBERS, chainLabel, GYM_MACHINES, machineExercise, machineInstructions, machineLibrary, MACHINE_EXERCISES, MACHINES, STARTER_EXERCISES, starterKey,
} from './index';

// D-178 : bibliothèque des machines de salle, rangée par type de machine.
describe('bibliothèque des machines', () => {
  it('des clés uniques, valides en base, distinctes des exercices de départ', () => {
    const keys = MACHINE_EXERCISES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const starters = new Set(STARTER_EXERCISES.map(([n]) => starterKey(n)));
    for (const k of keys) {
      expect(k).toMatch(/^[a-z0-9-]{1,80}$/); // contrainte de exercises.starter_key
      expect(starters.has(k)).toBe(false);
    }
    expect(new Set(GYM_MACHINES.map((m) => m.key)).size).toBe(GYM_MACHINES.length);
  });

  it('chaque exercice est complet : machine connue, trois consignes, erreur, alternative qui existe ailleurs', () => {
    const machines = new Set(GYM_MACHINES.map((m) => m.key));
    for (const e of MACHINE_EXERCISES) {
      expect(machines.has(e.machine), e.key).toBe(true);
      expect(e.name.length).toBeLessThanOrEqual(80);
      expect(e.cues).toHaveLength(3);
      expect(e.cues.every((c) => c.length > 5) && e.mistake.length > 5 && e.settings.length > 5 && e.muscles.length > 3).toBe(true);
      expect(alternativeName(e.alternative), `${e.key} → ${e.alternative}`).not.toBeNull();
      expect(e.alternative).not.toBe(e.key);
      // L’alternative se fait sur une autre machine (ou sans machine) : la machine est prise.
      expect(machineExercise(e.alternative)?.machine ?? null, e.key).not.toBe(e.machine);
      expect(machineInstructions(e).length).toBeLessThanOrEqual(1500);
      if (e.cardio) expect(MACHINES).toContain(e.cardio);
    }
  });

  it('chaque machine a au moins un exercice, les poulies et la Smith machine en ont beaucoup', () => {
    const lib = machineLibrary();
    expect(lib.map((g) => g.kind)).toEqual(['guided', 'cable', 'smith', 'plate', 'cardio']);
    for (const g of lib) for (const m of g.machines) expect(m.exercises.length, m.machine.key).toBeGreaterThan(0);
    const count = (k: string) => MACHINE_EXERCISES.filter((e) => e.machine === k).length;
    expect(count('poulie-double')).toBeGreaterThanOrEqual(12);
    expect(count('smith')).toBeGreaterThanOrEqual(8);
  });

  it('« Disponible chez Basic-Fit » est une étiquette avec son degré de certitude, pas une liste à part', () => {
    expect(GYM_MACHINES.every((m) => m.chains['basic-fit-be'])).toBe(true);
    expect(GYM_MACHINES.filter((m) => m.chains['basic-fit-be'] === 'sure').map((m) => m.key).sort())
      .toEqual(['developpe-incline', 'leg-extension', 'shoulder-press', 'tapis', 'velo-elliptique']);
  });

  it('vue Basic-Fit : nom anglais de chaque machine, numéro du club quand il est relevé', () => {
    expect(GYM_MACHINES.every((m) => /^[A-Z][A-Za-z /]+$/.test(m.en))).toBe(true);
    const press = GYM_MACHINES.find((m) => m.key === 'presse-cuisses')!;
    expect(chainLabel(press)).toBe('Leg Press');
    for (const k of Object.keys(CHAIN_NUMBERS['basic-fit-be'] ?? {})) expect(GYM_MACHINES.some((m) => m.key === k), k).toBe(true);
  });

  it('consignes écrites lisibles pour la bibliothèque du coach', () => {
    const t = machineInstructions(machineExercise('presse-a-cuisses')!);
    expect(t).toMatch(/^Réglages : Dossier/);
    expect(t).toContain('1. Pieds à plat');
    expect(t).toContain('Erreur fréquente : Descendre trop bas');
    expect(t).toContain('Si la machine est prise : Squat à la Smith machine.');
  });
});
