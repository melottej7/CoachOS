import { describe, expect, it } from 'vitest';
import { aiProposalSchema, describeTweaks, DAY_LABELS, generateProgram, NO_TWEAKS, redactNames, simulateProposal, type AiFacts, type ProgramInput } from './index';

// D-071 : réglages du générateur proposés par l’IA (ici simulée) ; le moteur construit et signale les risques.

const base: ProgramInput = {
  feasibility: {
    sport: 'running', distanceKm: 21.1, eventDate: '2027-03-14', targetSeconds: 7200, level: 'intermediate', practiceStatus: 'regular',
    longestRecent: '45to60', weeklySessions: '2to3', weeklyHours: '4to6', today: '2026-11-19',
  } as ProgramInput['feasibility'],
  startMonday: '2026-11-23', days: [2, 4, 6, 7], currentWeeklyMin: 120, refs: { vmaKmh: 15 }, goalTitle: 'Semi',
};
const facts: AiFacts = { sport: 'running', distanceKm: 21.1, weeks: 16, level: 'intermediate', days: [2, 4, 6, 7], tweaks: NO_TWEAKS };
const dow = (d: string) => ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

describe('réglages du générateur (D-071)', () => {
  it('sans réglage : programme identique ; réglages appliqués par le moteur, objectif toujours atteint', () => {
    expect(generateProgram({ ...base, tweaks: NO_TWEAKS })).toEqual(generateProgram(base));
    const p = generateProgram({ ...base, tweaks: { ...NO_TWEAKS, maxQualityPerWeek: 1, avoidQuality: ['vma'], longProgressive: true, longDay: 6 } });
    const all = p.weeks.flatMap((w) => w.sessions);
    expect(p.weeks.every((w) => w.sessions.filter((s) => s.kind === 'quality').length <= 1)).toBe(true);
    expect(all.some((s) => /VMA|PMA/.test(s.title))).toBe(false);
    expect(all.filter((s) => s.kind === 'long').every((s) => dow(s.date) === 6)).toBe(true);
    expect(all.filter((s) => s.kind === 'long' && s.minutes >= 40).every((s) => s.title.startsWith('Sortie longue progressive'))).toBe(true);
    // La séance longue nécessaire reste atteinte, même avec un volume réduit ; le risque est signalé.
    const low = generateProgram({ ...base, tweaks: { ...NO_TWEAKS, volumePct: 80 } });
    expect(Math.max(...low.weeks.map((w) => w.longMinutes))).toBe(Math.max(...generateProgram(base).weeks.map((w) => w.longMinutes)));
    expect(low.weeks.reduce((n, w) => n + w.minutes, 0)).toBeLessThan(generateProgram(base).weeks.reduce((n, w) => n + w.minutes, 0));
    expect(low.risks.some((r) => r.text.startsWith('Volume réglé à 80 %'))).toBe(true);
    expect(describeTweaks({ ...NO_TWEAKS, maxQualityPerWeek: 1, avoidQuality: ['vma'], longDay: 6 }, DAY_LABELS)).toEqual(['1 séance de qualité par semaine au plus', 'sans VMA / fractionné', 'séance longue le sam']);
  });

  it('IA simulée : demandes courantes traduites, réponse conforme au schéma ; abstention si rien n’est reconnu', () => {
    const a = simulateProposal('Moins de fractionné et la sortie longue le samedi, en progressive', facts);
    expect(aiProposalSchema.parse(a)).toMatchObject({ status: 'ready', tweaks: { maxQualityPerWeek: 1, longDay: 6, longProgressive: true } });
    expect(simulateProposal('pas de VMA', facts).tweaks.avoidQuality).toEqual(['vma']);
    expect(simulateProposal('allège de 15 %, elle est fatiguée', facts).tweaks.volumePct).toBe(85);
    expect(simulateProposal('entraînement lundi mercredi samedi', facts).days).toEqual([1, 3, 6]);
    expect(simulateProposal('Fais-lui un beau programme', facts)).toMatchObject({ status: 'abstain', days: null, tweaks: NO_TWEAKS });
  });

  it('noms de l’élève retirés avant tout envoi', () => {
    expect(redactNames('Moins de fractionné pour Emma Dupont, Emma est fatiguée', ['Emma Dupont'])).toBe('Moins de fractionné pour l’élève, l’élève est fatiguée');
  });
});
