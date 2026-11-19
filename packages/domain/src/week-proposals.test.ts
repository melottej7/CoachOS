import { describe, expect, it } from 'vitest';
import { easySession, isQuality, parseNotation, proposeWeek, scaleBlocks, type Block, type WeekSession } from './index';

// D-056 (CE-P-05) : propositions d’adaptation d’une semaine, sur le modèle de Foulée (capture 09).

const blocks = (t: string) => { const r = parseNotation(t, 'running'); expect(r.errors).toEqual([]); return r.blocks as Block[]; };
const s = (id: string, localDate: string, title: string, notation: string, locked = false): WeekSession =>
  ({ id, revision: 1, localDate, title, sport: 'running', blocks: blocks(notation), durationSeconds: null, locked });
const refs = { vmaKmh: 15 };
// Semaine type de Foulée : fractionné, seuil, footing, sortie longue.
const week = [
  s('a', '2026-11-24', 'Fractionné 5×400 m', "15' Z1 + 5×(400m Z6 + R1') + 10' Z1"),
  s('b', '2026-11-26', 'Seuil 3×6′', "15' Z1 + 3×(6' Z4 + R2') + 10' Z1"),
  s('c', '2026-11-28', 'Footing 50′', "50' Z2"),
  s('d', '2026-11-29', 'Sortie longue 1h20', "80' Z2"),
];

describe('propositions d’adaptation d’une semaine', () => {
  it('qualité reconnue par l’intensité', () => {
    expect(week.map((w) => isQuality(w, refs))).toEqual([true, true, false, false]);
  });

  it('alléger : environ un quart de volume en moins, intensité inchangée', () => {
    const p = proposeWeek(week, 'lighter', refs);
    expect(p.afterSeconds).toBeLessThan(p.beforeSeconds * 0.85);
    expect(p.afterSeconds).toBeGreaterThan(p.beforeSeconds * 0.6);
    const seuil = p.changes.find((c) => c.id === 'b')!.after!;
    expect(seuil.blocks.find((b) => b.type === 'repeat')).toMatchObject({ times: 2 });
    expect(isQuality({ blocks: seuil.blocks, sport: 'running' }, refs)).toBe(true);
  });

  it('récupération : la séance la plus exigeante saute (4 séances), la qualité devient facile', () => {
    const p = proposeWeek(week, 'recovery', refs);
    expect(p.changes.find((c) => c.id === 'a')!.after).toBeNull(); // Z6 : la plus intense
    const seuil = p.changes.find((c) => c.id === 'b')!.after!;
    expect(seuil.title).toMatch(/^Footing \d+′$/);
    expect(isQuality({ blocks: seuil.blocks, sport: 'running' }, refs)).toBe(false);
    expect(p.afterSeconds).toBeLessThan(proposeWeek(week, 'lighter', refs).afterSeconds);
  });

  it('endurance seule : plus aucune qualité ; la sortie longue reste une sortie longue', () => {
    const p = proposeWeek(week, 'endurance', refs);
    expect(p.changes.every((c) => !isQuality({ blocks: c.after!.blocks, sport: 'running' }, refs))).toBe(true);
    expect(p.changes.find((c) => c.id === 'd')!.after!.title).toBe('Sortie longue 1 h 10');
  });

  it('reprise : endurance et 40 minutes au plus par séance', () => {
    const p = proposeWeek(week, 'restart', refs);
    expect(p.changes.every((c) => c.after!.seconds <= 40 * 60)).toBe(true);
    expect(p.changes.map((c) => c.after!.title)).toEqual(['Footing 30′', 'Footing 40′', 'Footing 40′', 'Footing 40′']);
  });

  it('séances faites ou passées : jamais modifiées, mais comptées dans le volume', () => {
    const p = proposeWeek([{ ...week[0]!, locked: true }, ...week.slice(1)], 'restart', refs);
    expect(p.locked).toBe(1);
    expect(p.changes.map((c) => c.id)).toEqual(['b', 'c', 'd']);
    expect(p.afterSeconds).toBeGreaterThan(p.changes.reduce((n, c) => n + c.after!.seconds, 0));
  });

  it('outils : réduire une structure, séance facile selon le sport', () => {
    expect(scaleBlocks(blocks("2×(10' Z4 + R2')"), 0.75)[0]).toMatchObject({ times: 2, steps: [{ measure: { seconds: 480 } }, { measure: { seconds: 120 } }] });
    expect(easySession('cycling', 92).title).toBe('Sortie vélo facile 1 h 30');
    expect(easySession('swimming', 33).title).toBe('Nage facile 35′');
  });
});
