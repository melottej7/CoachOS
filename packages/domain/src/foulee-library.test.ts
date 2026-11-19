import { describe, expect, it } from 'vitest';
import { FOULEE_FAMILY_COUNT, fouleeLibrary, structureTotals } from './index';

// D-068 : bibliothèque Foulée, annexe F du dossier de transmission (79 familles, 324 séances).

describe('bibliothèque Foulée (D-068)', () => {
  const lib = fouleeLibrary();
  const fam = (id: string) => lib.filter((s) => s.family === id);

  it('324 séances en 79 familles, toutes lisibles, titres uniques, paliers calculés marqués pour le coach seulement', () => {
    expect(FOULEE_FAMILY_COUNT).toBe(79);
    expect(lib).toHaveLength(324);
    expect(lib.filter((s) => s.errors)).toEqual([]);
    expect(new Set(lib.map((s) => s.workout.title.toLowerCase())).size).toBe(324);
    expect(lib.every((s) => s.workout.intervals.length > 0 && s.workout.sport === 'running')).toBe(true);
    // D-077 : aucune note dans les consignes (l’élève les lirait) ; repères du coach dans meta.
    expect(lib.every((s) => s.workout.instructions === null)).toBe(true);
    expect(lib.filter((s) => s.meta.calculated)).toHaveLength(168);
    expect(lib.filter((s) => s.interpolated).every((s) => s.meta.calculated)).toBe(true);
  });

  it('premier et dernier paliers : titres de Foulée (annexe F)', () => {
    const ends = (id: string) => [fam(id)[0]!.workout.title, fam(id).at(-1)!.workout.title];
    expect(ends('footing')).toEqual(['Footing 20\'', 'Footing 1h10']);
    expect(ends('sortie-longue')).toEqual(['Sortie longue 50\'', 'Sortie longue 2h30']);
    expect(ends('sortie-longue-fin-allure')).toEqual(['Sortie longue 1h15 dont 15\' à allure course', 'Sortie longue 2h10 dont 40\' à allure course']);
    expect(ends('course-marche-1')).toEqual(['Course-marche 6×1\' (R1\'30)', 'Course-marche 12×1\' (R1\')']);
    expect(ends('seuil-temps')).toEqual(['Seuil 3×6\'', 'Seuil 3×15\'']);
    expect(ends('30-30-series')).toEqual(['30"/30" · 2×6', '30"/30" · 3×10']);
    expect(ends('pyramide')).toEqual(['Pyramide 1-2-3-2-1\'', 'Pyramide 1-2-3-4-3-2-1\'']);
    expect(ends('renfo')).toEqual(['Renfo express 10\'', 'PPG 30\'']);
    expect(ends('mobilite')).toEqual(['Mobilité 10\'', 'Mobilité 20\' hanches, chevilles et dos']);
    expect(ends('test-vma')).toEqual(['Test VMA 6\'', 'Test VMA 6\'']);
  });

  it('chaque famille progresse du palier le plus léger au plus chargé ; catégories pour le générateur', () => {
    const minutes = (id: string) => fam(id).map((s) => Math.round(structureTotals(s.workout.intervals).seconds / 60));
    for (const id of ['footing', 'sortie-longue', 'seuil-temps', 'tempo-continu', 'course-blocs']) {
      const m = minutes(id);
      expect(m.every((x, i) => i === 0 || x >= m[i - 1]!)).toBe(true);
    }
    expect(fam('seuil-temps')[0]!.category).toBe('threshold');
    expect(fam('tempo-continu')[0]!.category).toBe('tempo');
    expect(fam('400m')[0]!.category).toBe('intervals');
    expect(fam('sortie-longue')[0]!.category).toBe('long');
    expect(fam('allure-temps')[0]!.category).toBe('race'); // jamais prise pour l’allure de course du générateur
  });
});
