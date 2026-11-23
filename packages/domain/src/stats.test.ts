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
    expect(comparePeriods(cur, prev)).toMatchObject({ completionPts: 50, volumePct: 120, distancePct: null, rpeDiff: 1.5 });
    const empty = summarize([], '2026-09-28', '2026-10-04', '2026-11-19');
    expect(comparePeriods(prev, empty)).toMatchObject({ completionPts: null, volumePct: null, distancePct: null, rpeDiff: null });
    expect(deltaText(50, 'pts')).toBe('en hausse de 50 points');
    expect(deltaText(-8, 'pct')).toBe('en baisse de 8 %');
    expect(deltaText(2, 'pct')).toBe('stable');
    expect(deltaText(1.5, 'rpe')).toBe('en hausse de 1,5');
    expect(deltaText(null, 'pts')).toBeNull();
  });
});

describe('charge et répartition par sport (D-121)', () => {
  const item = (localDate: string, state: StatItem['state'], plannedSeconds: number, doneSeconds: number | null, rpe: number | null, sport: StatItem['sport']): StatItem =>
    ({ localDate, canceled: false, plannedSeconds, plannedMeters: null, state, doneSeconds, doneMeters: null, rpe, feeling: null, sport });
  const items = [
    item('2026-11-16', 'completed', 3600, 3600, 5, 'running'),
    item('2026-11-17', 'completed', 1800, null, 8, 'strength'),
    item('2026-11-18', 'completed', 1800, 1200, null, 'running'),
    item('2026-11-19', 'missed', 1800, null, 9, 'running'),
  ];
  it('charge = minutes réalisées × effort, séance par séance ; sans effort noté ou non faite, rien', () => {
    const s = summarize(items, '2026-11-16', '2026-11-22', '2026-11-22');
    expect(s.load).toBe(60 * 5 + 30 * 8);
    expect(s.loadSessions).toBe(2);
    expect(s.weeks[0]!.load).toBe(540);
    expect(s.weeks[0]!.avgRpe).toBe(6.5);
  });
  it('répartit le volume réalisé par sport, du plus grand au plus petit', () => {
    const s = summarize(items, '2026-11-16', '2026-11-22', '2026-11-22');
    expect(s.bySport).toEqual([{ sport: 'running', doneSeconds: 4800, share: 73 }, { sport: 'strength', doneSeconds: 1800, share: 27 }]);
  });
  it('compare la charge avec la période précédente', () => {
    const cur = summarize(items, '2026-11-16', '2026-11-22', '2026-11-22');
    const prev = summarize([item('2026-11-09', 'completed', 3600, 3600, 3, 'running')], '2026-11-09', '2026-11-15', '2026-11-22');
    expect(comparePeriods(cur, prev).loadPct).toBe(200);
  });
});
