import { describe, expect, it } from 'vitest';
import { assessGoal, chronoFromTitle, distanceFromTitle, goalMessage, goalSolutions, intermediateDistance, type FeasibilityInput } from './index';

// D-057 (CE-P-07) : faisabilité d’un objectif, sur le modèle de Foulée (capture 10).

const today = '2026-11-19';
// Le cas de la capture : 42,2 km en 3 h 45 le 17 janvier, 2 séances par semaine, endurance courte.
const foulee: FeasibilityInput = {
  sport: 'running', distanceKm: 42.2, eventDate: '2027-01-17', targetSeconds: 3 * 3600 + 45 * 60, level: 'intermediate',
  practiceStatus: 'regular', longestRecent: '45to60', weeklySessions: '2to3', weeklyHours: '2to4', today,
};

describe('faisabilité d’un objectif', () => {
  it('cas de Foulée : irréaliste en l’état, critères expliqués, les plus bloquants d’abord', () => {
    const a = assessGoal(foulee);
    expect(a.status).toBe('unrealistic');
    expect(a.facts.weeksLeft).toBe(8);
    expect(a.facts.longNeed).toBe(165); // à l’allure de son niveau (Foulée : 2 h 26 d’après le chrono)
    expect(a.criteria[0]!.level).toBe('block');
    expect(a.criteria.map((c) => c.key).sort()).toEqual(['chrono', 'delay', 'endurance', 'sessions', 'time']);
    expect(a.criteria.find((c) => c.key === 'sessions')!.text).toBe('2 séances par semaine, pour 5 conseillées sur 42,2 km avec un chrono.');
  });

  it('solutions chiffrées, chacune avec son statut ; « régulier, 10 km pour finir » est réalisable', () => {
    const s = goalSolutions(foulee);
    expect(s.map((x) => x.key)).toEqual(['later', 'time', 'finish', 'intermediate', 'sessions', 'keep']);
    expect(s.find((x) => x.key === 'keep')!.status).toBe('unrealistic');
    const later = s.find((x) => x.key === 'later')!;
    expect(assessGoal(later.input).criteria.find((c) => c.key === 'delay')!.level).toBe('ok');
    const easy = assessGoal({ ...foulee, distanceKm: 10, targetSeconds: null, eventDate: '2027-03-14', weeklySessions: '4to5', weeklyHours: '4to6', longestRecent: '60to90' });
    expect(easy.status).toBe('realistic');
  });

  it('retirer le chrono ne rend jamais l’objectif plus difficile', () => {
    const rank = { realistic: 0, ambitious: 1, risky: 2, unrealistic: 3 } as const;
    for (const km of [5, 10, 21.1, 30, 42.2]) for (const weeks of [6, 8, 10, 12, 16, 20]) {
      const date = new Date(Date.parse(`${today}T12:00:00Z`) + weeks * 7 * 86_400_000).toISOString().slice(0, 10);
      const withChrono = assessGoal({ ...foulee, distanceKm: km, eventDate: date, targetSeconds: Math.round(km * 300) });
      const finish = assessGoal({ ...foulee, distanceKm: km, eventDate: date, targetSeconds: null });
      expect(rank[finish.status]).toBeLessThanOrEqual(rank[withChrono.status]);
    }
  });

  it('tous les sports : vélo et natation estimés selon le niveau', () => {
    const velo = assessGoal({ ...foulee, sport: 'cycling', distanceKm: 100, targetSeconds: null, eventDate: '2027-06-01', weeklySessions: '4to5', weeklyHours: '6to10', longestRecent: 'gt120' });
    expect(velo.facts.eventMin).toBeCloseTo(250); // 100 km à 24 km/h
    expect(velo.status).toBe('realistic');
    const nage = assessGoal({ ...foulee, sport: 'swimming', distanceKm: 3.8, targetSeconds: null, eventDate: '2027-01-10', longestRecent: '30to45', weeklySessions: '2to3' });
    expect(['risky', 'unrealistic']).toContain(nage.status);
  });

  it('message proposé : prénom, statut, points et propositions', () => {
    const a = assessGoal(foulee);
    const m = goalMessage('Camille', 'Marathon de Séville', { input: foulee, a }, { input: foulee, a }, goalSolutions(foulee));
    expect(m).toMatch(/^Bonjour Camille, j’ai regardé ton objectif « Marathon de Séville »/);
    expect(m).toContain('trop juste');
    expect(m).toContain('Je te propose :');
    expect(m).not.toContain('Maintenir l’objectif');
    // Ajustement essayé : le message dit ce qui change et le statut obtenu.
    const semi = { ...foulee, distanceKm: 21.1, targetSeconds: null, eventDate: '2027-04-04' };
    const m2 = goalMessage('Camille', 'Marathon de Séville', { input: foulee, a }, { input: semi, a: assessGoal(semi) }, goalSolutions(semi));
    expect(m2).toContain('Je te propose de préparer d’abord 21,1 km, puis 42,2 km sur la préparation suivante, et de viser une course vers le 4 avril 2027, et de viser de finir, sans chrono.');
    expect(m2).toMatch(/Ainsi, il (me paraît|est)/);
  });

  it('distance lue dans le titre ; distance intermédiaire', () => {
    expect(distanceFromTitle('Marathon de Paris')).toBe(42.2);
    expect(distanceFromTitle('Semi de Bruxelles')).toBe(21.1);
    expect(distanceFromTitle('Trail des Fagnes 30 km')).toBe(30);
    expect(distanceFromTitle('Gravel 100,5 km')).toBe(100.5);
    expect(distanceFromTitle('Reprendre en douceur')).toBeNull();
    expect(chronoFromTitle('Semi-marathon en moins de 1 h 45')).toBe(6300);
    expect(chronoFromTitle('Marathon en 3h45')).toBe(13500);
    expect(chronoFromTitle('10 km sous 50 min')).toBe(3000);
    expect(chronoFromTitle('Finir le Trail des Fagnes')).toBeNull();
    expect([intermediateDistance(42.2), intermediateDistance(21.1), intermediateDistance(10), intermediateDistance(30)]).toEqual([21.1, 10, 5, 15]);
  });

  it('passif (D-058) : un coureur expérimenté qui a déjà fait la distance n’est pas jugé comme un débutant', () => {
    const same = { ...foulee, weeklySessions: '4to5' as const, weeklyHours: '6to10' as const };
    const none = assessGoal(same);
    const veteran = assessGoal({ ...same, history: { experience: 'gt5', breakLength: null, resumedSince: null, recentLongestDoneMin: 130, regularity: { due: 10, done: 10 }, achievedKm: 42.2 } });
    expect(veteran.facts.weeksAdvised).toBeLessThan(none.facts.weeksAdvised);
    expect(veteran.facts.current).toBe(130); // ce qu’il a vraiment fait compte plus que la case du bilan
    expect(veteran.facts.buildWeeks).toBeLessThan(none.facts.buildWeeks);
    const rank = { realistic: 0, ambitious: 1, risky: 2, unrealistic: 3 } as const;
    expect(rank[veteran.status]).toBeLessThan(rank[none.status]);
    expect(veteran.criteria.find((c) => c.key === 'history')!.text).toContain('a déjà réalisé 42,2 km');
    expect(veteran.criteria.find((c) => c.key === 'regularity')!).toMatchObject({ level: 'ok', text: '10 séances faites sur 10 ces 4 dernières semaines (100 %).' });
  });

  it('passif : reprise très récente après un long arrêt, ou régularité réelle faible, rendent prudent', () => {
    const fragile = assessGoal({ ...foulee, practiceStatus: 'resumed', history: { experience: 'gt5', breakLength: '1to3y', resumedSince: 'lt1m', recentLongestDoneMin: null, regularity: { due: 8, done: 3 }, achievedKm: null } });
    expect(fragile.criteria.find((c) => c.key === 'history')!.level).toBe('risk');
    expect(fragile.criteria.find((c) => c.key === 'regularity')!.level).toBe('risk');
    // Sans assez de séances suivies, pas de critère de régularité.
    expect(assessGoal({ ...foulee, history: { experience: null, breakLength: null, resumedSince: null, recentLongestDoneMin: null, regularity: { due: 2, done: 0 }, achievedKm: null } }).criteria.some((c) => c.key === 'regularity')).toBe(false);
  });
});

