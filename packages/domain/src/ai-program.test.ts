import { describe, expect, it } from 'vitest';
import { checkProgramDraft, programRequestSchema, simulateProgram, type ProgramDraft } from './index';

// IA-3 (D-191) : programme rédigé par l’agent, relu et contrôlé par le serveur.

const target = { kind: 'athlete' as const, id: '20000000-0000-4000-8000-000000000001' };
const ex = [{ nom: 'Presse à cuisses', muscle: 'legs', machine: true }, { nom: 'Tirage vertical (lat pulldown)', muscle: 'pull', machine: true }, { nom: 'Gainage', muscle: 'core', machine: false }];

describe('programme par l’agent (IA-3)', () => {
  it('demande bornée : 1 à 12 semaines, premier jour un lundi', () => {
    expect(programRequestSchema.safeParse({ text: 'Force', weeks: 8, startMonday: '2026-11-30', target }).success).toBe(true);
    expect(programRequestSchema.safeParse({ text: 'Force', weeks: 13, startMonday: '2026-11-30', target }).success).toBe(false);
    expect(programRequestSchema.safeParse({ text: 'Force', weeks: 4, startMonday: '2026-12-01', target }).success).toBe(false);
  });

  it('simulation : déterministe, semaine légère toutes les 4, charges reprises ou « charge à choisir » ; tout se lit', () => {
    const input = { text: '8 semaines de force, 3 séances par semaine, salle Basic-Fit', weeks: 8, sport: null, exercises: ex, loads: { 'presse à cuisses': 60 } };
    const d = simulateProgram(input);
    expect(d).toEqual(simulateProgram(input));
    expect(d.semaines).toHaveLength(8);
    expect(d.semaines[0]!.seances.map((s) => s.jour)).toEqual([1, 3, 5]);
    expect(d.semaines[3]!.intention).toMatch(/légère/);
    const lines = d.semaines[0]!.seances[0]!.lignes;
    expect(lines.some((l) => /presse à cuisses 60kg/.test(l))).toBe(true);
    expect(lines.some((l) => /« charge à choisir »/.test(l))).toBe(true);
    const c = checkProgramDraft(d, '2026-11-30', 8);
    expect(c.weeks.every((w) => w.sessions.every((s) => s.ok))).toBe(true);
    expect(c.weeks[1]!.sessions[0]!.date).toBe('2026-12-07');
    expect(c.ok).toBe(true);
  });

  it('demande impossible : abstention expliquée', () => {
    const d = simulateProgram({ text: '10 séances par semaine', weeks: 4, sport: 'running', exercises: [], loads: {} });
    expect(d).toMatchObject({ status: 'abstain', semaines: [] });
    expect(d.remarque).toMatch(/entre 1 et 6/);
  });

  it('contrôles : ligne illisible montrée, jour en double et semaine en trop bloquent, hausse de volume signalée ; rien corrigé', () => {
    const draft: ProgramDraft = { status: 'ready', intention: '', remarque: '', semaines: [
      { numero: 1, intention: '', seances: [{ jour: 2, sport: 'running', titre: 'Footing', lignes: ["30' Z2"] }, { jour: 2, sport: 'running', titre: 'Bis', lignes: ['fais un effort'] }] },
      { numero: 2, intention: '', seances: [{ jour: 2, sport: 'running', titre: 'Long', lignes: ["1h30 Z2"] }] },
      { numero: 5, intention: '', seances: [] },
    ] };
    const c = checkProgramDraft(draft, '2026-11-30', 2);
    expect(c.ok).toBe(false);
    expect(c.weeks).toHaveLength(2);
    expect(c.weeks[0]!.sessions[1]).toMatchObject({ ok: false, notation: '' });
    expect(c.weeks[0]!.sessions[1]!.lines[0]!.error).toBeTruthy();
    const texts = c.risks.map((r) => r.text).join(' | ');
    expect(texts).toMatch(/deux séances le même jour/);
    expect(texts).toMatch(/Semaine 5 en double ou hors du programme/);
    expect(texts).toMatch(/Semaine 2 : volume en hausse de 200 %/);
    expect(texts).toMatch(/1 séance à reprendre à la main/);
  });
});
