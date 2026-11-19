import { describe, expect, it } from 'vitest';
import {
  coachMethodSchema, EMPTY_METHOD, generateProgram, learnCandidates, mergeTweaks, methodTweaksFor, NO_TWEAKS, observeEdit, observeKept, observeTweaks,
  parseNotation, ruleLabel, type Block, type MethodEvidence, type MethodRule, type ProgramInput,
} from './index';

// D-072 : méthode du coach (Coach DNA) : règles typées appliquées par défaut ; candidates apprises des corrections.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rule = (r: Partial<MethodRule> & Pick<MethodRule, 'kind'>, n = 1) => ({ id: id(n), source: 'manual', support: null, scope: { level: null, sport: null }, ...r }) as MethodRule;
const blocks = (t: string) => parseNotation(t, 'running').blocks as Block[];

describe('méthode du coach (D-072)', () => {
  it('règles appliquées par défaut ; la plus précise l’emporte ; le programme prime', () => {
    const rules = [
      rule({ kind: 'max_quality', n: 2 }, 1),
      rule({ kind: 'max_quality', n: 1, scope: { level: 'beginner', sport: null } }, 2),
      rule({ kind: 'avoid_quality', quality: 'vma', scope: { level: 'beginner', sport: null } }, 3),
      rule({ kind: 'long_day', day: 6 }, 4),
    ];
    expect(methodTweaksFor(rules, { level: 'beginner', sport: 'running' })).toMatchObject({ maxQualityPerWeek: 1, avoidQuality: ['vma'], longDay: 6 });
    expect(methodTweaksFor(rules, { level: 'advanced', sport: 'running' })).toMatchObject({ maxQualityPerWeek: 2, avoidQuality: [], longDay: 6 });
    const merged = mergeTweaks(methodTweaksFor(rules, { level: 'beginner', sport: 'running' }), { ...NO_TWEAKS, longDay: 7, avoidQuality: ['threshold'] })!;
    expect(merged).toMatchObject({ longDay: 7, maxQualityPerWeek: 1, avoidQuality: ['vma', 'threshold'] });
    expect(ruleLabel(rules[2]!)).toBe('pas de séance de VMA / fractionné, pour les débutants');
    expect(coachMethodSchema.safeParse({ ...EMPTY_METHOD, rules: [{ kind: 'volume_pct', pct: 200, id: id(9), source: 'manual', scope: {} }] }).success).toBe(false);
    // Le générateur applique la méthode : sortie longue le samedi.
    const base: ProgramInput = {
      feasibility: { sport: 'running', distanceKm: 10, eventDate: '2027-02-28', targetSeconds: null, level: 'beginner', practiceStatus: 'regular', longestRecent: '45to60', weeklySessions: '2to3', weeklyHours: '4to6', today: '2026-11-19' } as ProgramInput['feasibility'],
      startMonday: '2026-11-23', days: [2, 4, 6, 7], currentWeeklyMin: 100, goalTitle: '10 km', tweaks: methodTweaksFor(rules, { level: 'beginner', sport: 'running' }),
    };
    const p = generateProgram(base);
    expect(p.weeks.slice(0, -1).flatMap((w) => w.sessions.filter((s) => s.kind === 'long')).every((s) => new Date(`${s.date}T12:00:00Z`).getUTCDay() === 6)).toBe(true);
  });

  it('observations : longue déplacée, VMA retirée ou adoucie, footing raccourci ; contre-exemples ; réglages', () => {
    const long = { date: '2026-11-29', title: 'Sortie longue 1 h 10', blocks: blocks("70' Z2") };
    expect(observeEdit(long, { ...long, date: '2026-11-28', canceled: false })).toEqual([{ key: 'long_day:6' }]);
    const vma = { date: '2026-11-24', title: 'VMA 8 × 400 m', blocks: blocks("15' Z2 + 8×(400m Z6 + R1'30) + 10' Z1") };
    expect(observeEdit(vma, { ...vma, title: 'Footing 40′', blocks: blocks("40' Z2"), canceled: false })).toEqual([{ key: 'avoid_quality:vma' }]);
    expect(observeEdit(vma, { ...vma, canceled: true })).toEqual([{ key: 'avoid_quality:vma' }]);
    const easy = { date: '2026-11-26', title: 'Footing 40′', blocks: blocks("40' Z2") };
    expect(observeEdit(easy, { ...easy, blocks: blocks("30' Z2"), canceled: false })).toEqual([{ key: 'volume_pct', value: 0.75 }]);
    expect(observeKept(vma)).toEqual(['avoid_quality:vma']);
    expect(observeKept(long)).toContain('long_day:6');
    expect(observeTweaks({ ...NO_TWEAKS, avoidQuality: ['vma'], longDay: 6 })).toEqual([{ key: 'avoid_quality:vma' }, { key: 'long_day:6' }]);
  });

  it('candidates : 5 observations indépendantes sur 2 semaines, 80 % de concordance ; portée commune ; écartée ou déjà règle = rien', () => {
    const ev = (key: string, a: string, week: string, level: MethodEvidence['level'] = 'beginner'): MethodEvidence => ({ key, athleteId: a, week, level, sport: 'running' });
    const obs = [ev('avoid_quality:vma', 'a', 'w1'), ev('avoid_quality:vma', 'a', 'w1'), ev('avoid_quality:vma', 'a', 'w2'), ev('avoid_quality:vma', 'b', 'w1'), ev('avoid_quality:vma', 'b', 'w2'), ev('avoid_quality:vma', 'c', 'w2')];
    // 5 observations distinctes (le doublon a/w1 compte une fois), 2 semaines, aucun contre-exemple.
    const c = learnCandidates(obs, [], EMPTY_METHOD);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ key: 'avoid_quality:vma', support: 5, weeks: 2, athletes: 3, counter: 0, rule: { kind: 'avoid_quality', quality: 'vma', scope: { level: 'beginner', sport: 'running' } } });
    expect(c[0]!.label).toBe('pas de séance de VMA / fractionné, pour les débutants en course à pied');
    // Trop peu, une seule semaine, ou trop de contre-exemples : pas de proposition.
    expect(learnCandidates(obs.slice(0, 4), [], EMPTY_METHOD)).toEqual([]);
    expect(learnCandidates(['a', 'b', 'c', 'd', 'e'].map((a) => ev('avoid_quality:vma', a, 'w1')), [], EMPTY_METHOD)).toEqual([]);
    expect(learnCandidates(obs, ['x', 'y'].map((a) => ev('avoid_quality:vma', a, 'w3')), EMPTY_METHOD)).toEqual([]); // 5/7 < 80 %
    expect(learnCandidates(obs, [], { ...EMPTY_METHOD, dismissed: ['avoid_quality:vma'] })).toEqual([]);
    expect(learnCandidates(obs, [], { ...EMPTY_METHOD, rules: [rule({ kind: 'avoid_quality', quality: 'vma' })] })).toEqual([]);
    // Volume : médiane des réductions, arrondie à 5 %.
    const vol = ['a', 'b', 'c', 'd', 'e'].map((a, i) => ({ ...ev('volume_pct', a, i < 3 ? 'w1' : 'w2', null), value: [0.8, 0.75, 0.85, 0.8, 0.9][i] }));
    expect(learnCandidates(vol, [], EMPTY_METHOD)[0]).toMatchObject({ rule: { kind: 'volume_pct', pct: 80, scope: { level: null } } });
  });

  it('VMA écartée : jamais de VMA ni de PMA, même en vélo avec un chrono visé (allure objectif en Z4)', () => {
    const bike: ProgramInput = {
      feasibility: { sport: 'cycling', distanceKm: 60, eventDate: '2027-02-28', targetSeconds: 7200, level: 'intermediate', practiceStatus: 'regular', longestRecent: '60to90', weeklySessions: '4to5', weeklyHours: '4to6', today: '2026-11-19' } as ProgramInput['feasibility'],
      startMonday: '2026-11-23', days: [2, 4, 6, 7], currentWeeklyMin: 180, goalTitle: '60 km', tweaks: methodTweaksFor([rule({ kind: 'avoid_quality', quality: 'vma' })], { level: 'intermediate', sport: 'cycling' }),
    };
    const titles = generateProgram(bike).weeks.flatMap((w) => w.sessions.map((s) => s.title));
    expect(titles.some((t) => /VMA|PMA/.test(t))).toBe(false);
    expect(titles.some((t) => t.startsWith('Allure objectif'))).toBe(true);
  });
});

