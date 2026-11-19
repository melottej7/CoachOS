import { describe, expect, it } from 'vitest';
import { comparePeriods, daysUntil, deltaText, summarize, type StatItem } from './index';

const item = (localDate: string, over: Partial<StatItem> = {}): StatItem => ({
  localDate, canceled: false, plannedSeconds: 3600, plannedMeters: null, state: null, doneSeconds: null, doneMeters: null, rpe: null, feeling: null, ...over,
});

describe('statistiques d’entraînement', () => {
  const today = '2026-11-19'; // jeudi
  const items = [
    item('2026-11-02', { state: 'completed', rpe: 5, feeling: 4 }),
    item('2026-11-04', { state: 'missed' }),
    item('2026-11-10', { state: 'partial', doneSeconds: 1800, rpe: 7 }),
    item('2026-11-12', { canceled: true }),
    item('2026-11-17', { state: 'completed', doneSeconds: 4000, doneMeters: 10000, feeling: 2 }),
    item('2026-11-18'),
    item('2026-11-21'), // à venir : ni due ni manquée
  ];

  it('compte la régularité sur les séances passées seulement, annulées exclues', () => {
    const s = summarize(items, '2026-11-02', '2026-11-22', today);
    expect(s.due).toBe(5);
    expect(s.done).toBe(3);
    expect(s.missed).toBe(1);
    expect(s.noFeedback).toBe(1);
    expect(s.completion).toBe(60);
  });

  it('volume réalisé : déclaré, sinon prévu pour une séance faite en entier', () => {
    const s = summarize(items, '2026-11-02', '2026-11-22', today);
    expect(s.weeks.map((w) => w.doneSeconds)).toEqual([3600, 1800, 4000]);
    expect(s.weeks.map((w) => w.planned)).toEqual([2, 1, 3]);
    expect(s.doneMeters).toBe(10000);
    expect(s.avgRpe).toBe(6);
    expect(s.avgFeeling).toBe(3);
  });

  it('série de semaines, la semaine en cours ne la coupe pas', () => {
    expect(summarize(items, '2026-11-02', '2026-11-22', today).streakWeeks).toBe(3);
    const gap = [item('2026-11-02', { state: 'completed' }), item('2026-11-17', { state: 'completed' })];
    expect(summarize(gap, '2026-11-02', '2026-11-22', today).streakWeeks).toBe(1);
    expect(summarize([item('2026-11-10', { state: 'completed' })], '2026-11-02', '2026-11-22', today).streakWeeks).toBe(1);
  });

  it('compte à rebours', () => {
    expect(daysUntil('2026-11-19', '2026-12-01')).toBe(12);
  });

  it('comparaison avec la période précédente (D-050) : points, %, effort ; rien sans base de comparaison', () => {
    const it2 = (localDate: string, state: StatItem['state'], doneSeconds: number | null, rpe: number | null): StatItem => ({
      localDate, canceled: false, plannedSeconds: 3600, plannedMeters: null, state, doneSeconds, doneMeters: null, rpe, feeling: null,
    });
    const prev = summarize([it2('2026-10-05', 'completed', 3000, 5), it2('2026-10-07', 'missed', null, null)], '2026-10-05', '2026-10-11', '2026-11-19');
    const cur = summarize([it2('2026-10-12', 'completed', 3600, 6), it2('2026-10-14', 'completed', 3000, 7)], '2026-10-12', '2026-10-18', '2026-11-19');
    expect(comparePeriods(cur, prev)).toEqual({ completionPts: 50, volumePct: 120, distancePct: null, rpeDiff: 1.5 });
    const empty = summarize([], '2026-09-28', '2026-10-04', '2026-11-19');
    expect(comparePeriods(prev, empty)).toEqual({ completionPts: null, volumePct: null, distancePct: null, rpeDiff: null });
    expect(deltaText(50, 'pts')).toBe('en hausse de 50 points');
    expect(deltaText(-8, 'pct')).toBe('en baisse de 8 %');
    expect(deltaText(2, 'pct')).toBe('stable');
    expect(deltaText(1.5, 'rpe')).toBe('en hausse de 1,5');
    expect(deltaText(null, 'pts')).toBeNull();
  });
});
