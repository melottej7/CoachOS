import { describe, expect, it } from 'vitest';
import { assessGoal, equivalents, goalSolutions, formatDuration2, parseDuration, predictTime, vmaFromTest, type FeasibilityInput, type Performance } from './index';

// D-060 : résultats de référence, prédiction de Riegel, équivalences, VMA d’un test ; chrono jugé sur des faits.

const today = '2026-11-19';
const p = (over: Partial<Performance>): Performance => ({ id: 'x', sport: 'running', kind: 'race', name: '10 km de Bruxelles', distanceM: 10000, durationS: 50 * 60, doneOn: '2026-09-20', ...over });

describe('résultats de référence', () => {
  it('saisie des temps', () => {
    expect([parseDuration('45:30'), parseDuration('1:45:30'), parseDuration('1h45'), parseDuration("1h45'30"), parseDuration("38'20"), parseDuration('6\'')])
      .toEqual([2730, 6330, 6300, 6330, 2300, 360]);
    expect(parseDuration('45:75')).toBeNull();
    expect(parseDuration('vite')).toBeNull();
    expect(formatDuration2(6330)).toBe('1:45:30');
    expect(formatDuration2(2730)).toBe('45:30');
  });

  it('prédiction de Riegel depuis le résultat le plus proche, récent et du même sport', () => {
    const perfs = [p({}), p({ id: 'old', distanceM: 21097, durationS: 1.75 * 3600, doneOn: '2025-01-10' }), p({ id: 'velo', sport: 'cycling', distanceM: 100000, durationS: 4 * 3600 })];
    const semi = predictTime(perfs, 'running', 21.1, today)!;
    expect(semi.from.id).toBe('x'); // le semi de 2025 est trop ancien
    expect(semi.seconds).toBe(Math.round(3000 * Math.pow(2.11, 1.06)));
    expect(semi.label).toBe('10 km de Bruxelles : 10 km en 50:00');
    expect(predictTime(perfs, 'running', 100, today)).toBeNull(); // trop loin de 10 km
    expect(predictTime(perfs, 'cycling', 100, today)).toBeNull(); // pas de modèle fiable en vélo
  });

  it('équivalences et VMA d’un test de 6 minutes', () => {
    expect(equivalents(p({})).map((e) => e.label)).toEqual(['5 km', '10 km', 'Semi', 'Marathon']);
    expect(equivalents(p({})).find((e) => e.label === '10 km')!.seconds).toBe(3000);
    expect(vmaFromTest(p({ kind: 'test', distanceM: 1500, durationS: 360 }))).toBe(15);
    expect(vmaFromTest(p({}))).toBeNull();
  });

  it('faisabilité : le chrono visé est jugé sur la prédiction', () => {
    const base: FeasibilityInput = {
      sport: 'running', distanceKm: 21.1, eventDate: '2027-03-14', targetSeconds: null, level: 'intermediate', practiceStatus: 'regular',
      longestRecent: '60to90', weeklySessions: '4to5', weeklyHours: '4to6', today,
      history: { experience: '3to5', breakLength: null, resumedSince: null, recentLongestDoneMin: null, regularity: null, achievedKm: 10, performances: [p({ name: null })] },
    };
    const chrono = (s: number) => assessGoal({ ...base, targetSeconds: s }).criteria.find((c) => c.key === 'chrono')!;
    const pred = Math.round(3000 * Math.pow(2.11, 1.06));
    expect(chrono(pred + 300).level).toBe('ok');            // plus lent que prévu
    expect(chrono(Math.round(pred * 0.98)).level).toBe('watch'); // 2 % plus rapide
    expect(chrono(Math.round(pred * 0.95)).level).toBe('risk');  // 5 % plus rapide
    expect(chrono(Math.round(pred * 0.87)).level).toBe('block'); // 13 % plus rapide
    expect(chrono(6000).text).toContain(`Temps prévu d’après ses résultats (Course : 10 km en 50:00) : ${formatDuration2(pred)}.`);
    // La durée d’épreuve vient de la prédiction, et suit la distance d’une solution (objectif intermédiaire).
    expect(assessGoal(base).facts.eventMin).toBeCloseTo(pred / 60);
    const mid = goalSolutions({ ...base, targetSeconds: 6000 }).find((s) => s.key === 'intermediate')!;
    expect(assessGoal(mid.input).facts.eventMin).toBeCloseTo(3000 / 60);
  });
});
