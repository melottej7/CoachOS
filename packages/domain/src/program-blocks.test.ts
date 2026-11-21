import { describe, expect, it } from 'vitest';
import { programBlocks, weekDelta, type ProgramWeek } from './index';

// D-106 : blocs du programme (tremplin, cycles de développement fermés par leur semaine allégée, affûtage).

const wk = (index: number, phase: ProgramWeek['phase'], minutes: number): ProgramWeek => ({ index, monday: `2026-01-${String(index).padStart(2, '0')}`, phase, minutes, longMinutes: 60, sessions: [] });

describe('blocs du programme', () => {
  it('3 semaines + 1 allégée par cycle ; un dernier cycle sans allégée ; affûtage à part', () => {
    const weeks = [
      wk(1, 'tremplin', 100), wk(2, 'tremplin', 110),
      wk(3, 'developpement', 120), wk(4, 'developpement', 130), wk(5, 'developpement', 140), wk(6, 'recuperation', 105),
      wk(7, 'developpement', 145), wk(8, 'developpement', 150),
      wk(9, 'affutage', 90),
    ];
    const b = programBlocks(weeks);
    expect(b.map((x) => [x.n, x.phase, x.weeks.map((w) => w.index), x.loadWeeks, x.lightWeeks])).toEqual([
      [1, 'tremplin', [1, 2], 2, 0],
      [2, 'developpement', [3, 4, 5, 6], 3, 1],
      [3, 'developpement', [7, 8], 2, 0],
      [4, 'affutage', [9], 1, 0],
    ]);
    expect(weekDelta(weeks, 6)).toBe(-25);
    expect(weekDelta(weeks, 1)).toBeNull();
  });
  it('une semaine allégée sans cycle avant forme son propre bloc ; la décharge ferme le tremplin (D-107)', () => {
    expect(programBlocks([wk(1, 'recuperation', 80), wk(2, 'tremplin', 90)]).map((x) => x.phase)).toEqual(['recuperation', 'tremplin']);
    const b = programBlocks([wk(1, 'tremplin', 100), wk(2, 'tremplin', 110), wk(3, 'tremplin', 120), wk(4, 'recuperation', 96), wk(5, 'developpement', 125)]);
    expect(b.map((x) => [x.phase, x.weeks.length, x.loadWeeks, x.lightWeeks])).toEqual([['tremplin', 4, 3, 1], ['developpement', 1, 1, 0]]);
  });
});
