import { describe, expect, it } from 'vitest';
import { parseNotation, sessionView } from './index';

// D-129 · Lecture d’une séance d’un coup d’œil.
describe('sessionView', () => {
  const refs = { vmaKmh: 15, ftpW: null, cssSecPer100: null };
  it('footing : durée, distance estimée, bande et allures personnelles', () => {
    const blocks = parseNotation("10' Z1 + 20' Z2 + 5' Z1", 'running').blocks;
    const v = sessionView(blocks, 'running', refs);
    expect(v.minutes).toBe(35);
    expect(v.km).toMatch(/km$/);
    expect(v.kmApprox).toBe(true);
    expect(v.segments.map((s) => s.zone)).toEqual([1, 2, 1]);
    expect(v.rows).toHaveLength(3);
    expect(v.rows[1]!.zone).toBe(2);
    expect(v.rows[1]!.target).toMatch(/\/km$/);
    expect(v.keyZone).toBe(2);
  });
  it('fractionné : une ligne pour la répétition, zone la plus haute, cible de l’effort', () => {
    const blocks = parseNotation("15' Z2 + 10×(30\" Z6 + 30\" Z1) + 10' Z1", 'running').blocks;
    const v = sessionView(blocks, 'running', refs);
    expect(v.rows).toHaveLength(3);
    expect(v.rows[1]!.repeat).toBe(true);
    expect(v.rows[1]!.zone).toBe(6);
    expect(v.rows[1]!.title.startsWith('10 ×')).toBe(true);
    expect(v.rows[1]!.target).toMatch(/\/km$/);
    expect(v.segments.length).toBe(22);
    expect(v.keyZone).toBe(6);
  });
  it('séance sans structure : durée déclarée, aucune ligne', () => {
    const v = sessionView([], 'cycling', refs, 3000);
    expect(v.minutes).toBe(50);
    expect(v.rows).toEqual([]);
    expect(v.segments).toEqual([]);
  });
});

describe('sessionView · musculation (D-129)', () => {
  it('se lit en exercices et en séries, sans zones', () => {
    const blocks = parseNotation('4×(renfo 10 squats + renfo repos 1\')', 'strength').blocks;
    const v = sessionView(blocks, 'strength');
    expect(v.kind).toBe('strength');
    expect(v.sets).toBe(4);
    expect(v.exercises).toBe(1);
    expect(v.rows[0]!.badge).toBe('4×');
    expect(v.rows[0]!.zone).toBe(0);
    expect(v.rows[0]!.detail).toMatch(/^4 séries · 10 répétitions/);
    expect(v.rows[0]!.detail).toMatch(/repos 1:00|repos 1 min/);
  });
});

describe('sessionView · répétitions effort et récupération (D-129)', () => {
  it('se lisent « 3 × 8:00 » et « récupération 3:00 en Z1 »', () => {
    const v = sessionView(parseNotation("15' Z2 + 3×(8' Z4 + R3' Z1) + 10' Z1", 'cycling').blocks, 'cycling', { vmaKmh: null, ftpW: 240, cssSecPer100: null });
    expect(v.rows[1]!.title).toMatch(/^3 × /);
    expect(v.rows[1]!.detail).toMatch(/^récupération .* en Z1$/);
    expect(v.rows[1]!.target).toMatch(/W$/);
  });
});
