import { describe, expect, it } from 'vitest';
import { weekReview, type ReviewSession } from './index';

// D-073 : résumé de semaine sans IA : prévu, déclaré, manquant ; trois faits au plus ; une seule question.

const s = (date: string, over: Partial<ReviewSession> = {}): ReviewSession => ({
  date, title: 'Footing', canceled: false, plannedSeconds: 2400, state: 'completed', doneSeconds: 2400, rpe: 4, feeling: 4, difficulties: [], ...over,
});
const monday = '2026-11-09', today = '2026-11-19';

describe('résumé de la semaine (D-073)', () => {
  it('semaine régulière : faits chiffrés, question de suite', () => {
    const r = weekReview([s('2026-11-10'), s('2026-11-12'), s('2026-11-15', { plannedSeconds: 4800, doneSeconds: 5100, rpe: 6 })], monday, today);
    expect(r.status).toBe('ok');
    expect(r.facts[0]).toBe('3 séances faites sur 3 · 2 h 45 déclarées pour 2 h 40 prévues.');
    expect(r.facts[1]).toBe('Effort moyen déclaré 4,7/10.');
    expect(r.question).toMatch(/^Belle régularité/);
    expect(r.facts.length).toBeLessThanOrEqual(3);
  });

  it('manquée, sans retour, effort élevé : la question vise d’abord ce qui manque ; l’absence de retour n’est pas une séance manquée', () => {
    const r = weekReview([
      s('2026-11-10', { state: 'missed', title: 'Seuil 3 × 8′', doneSeconds: null, rpe: null }),
      s('2026-11-12', { state: null, doneSeconds: null, rpe: null }),
      s('2026-11-14', { rpe: 8, feeling: 2, difficulties: ['fatigue'] }),
      s('2026-11-15', { rpe: 9, difficulties: ['fatigue'] }),
    ], monday, today);
    expect(r.counts).toMatchObject({ planned: 4, completed: 2, missed: 1, noFeedback: 1 });
    expect(r.facts[1]).toBe('1 non faite, 1 séance sans retour (on ne sait pas si elle a été faite).');
    expect(r.facts[2]).toBe('Effort moyen déclaré 8,5/10 (2 séances à 8 ou plus) ; ressenti « fatigué » ou moins sur 1 séance ; difficulté notée : fatigue (2 fois).');
    expect(r.question).toBe('Qu’est-ce qui t’a empêché de faire « Seuil 3 × 8′ » ? On adapte la semaine prochaine si besoin.');
    // Sans la séance manquée : la question passe à l’effort.
    expect(weekReview([s('2026-11-14', { rpe: 8 }), s('2026-11-15', { rpe: 9 })], monday, today).question).toMatch(/dures/);
  });

  it('données insuffisantes ; séances annulées et futures ignorées ; aujourd’hui exclu', () => {
    expect(weekReview([s('2026-11-10')], monday, today)).toMatchObject({ status: 'insufficient', question: null });
    expect(weekReview([s('2026-11-10'), s('2026-11-11', { canceled: true })], monday, today).status).toBe('insufficient');
    // Semaine en cours : la séance du jour n’est pas encore comptée.
    expect(weekReview([s('2026-11-17'), s('2026-11-18'), s('2026-11-19', { state: null })], '2026-11-16', today).counts).toMatchObject({ planned: 2, noFeedback: 0 });
  });
});

// D-088 : « pas à 100 % » dans le résumé de la semaine, sans cause.
describe('résumé de la semaine : pas à 100 %', () => {
  it('fait et question en priorité, même avec peu de données', async () => {
    const { weekReview } = await import('./week-review');
    const s = (date: string, readiness: 'full' | 'not_quite' | 'no' | null) => ({ date, title: 'Footing', canceled: false, plannedSeconds: 1800, state: 'completed' as const, doneSeconds: 1800, rpe: 5, feeling: 4, difficulties: [], readiness });
    const r = weekReview([s('2026-11-16', 'full'), s('2026-11-18', 'no'), s('2026-11-20', null)], '2026-11-16', '2026-11-23');
    expect(r.facts.at(-1)).toBe('A répondu ne pas être à 100 % en ce moment.');
    expect(r.question).toMatch(/pas être à 100 %/);
    const one = weekReview([s('2026-11-18', 'not_quite')], '2026-11-16', '2026-11-23');
    expect(one.status).toBe('insufficient');
    expect(one.facts).toContain('A répondu ne pas être tout à fait à 100 % en ce moment.');
    expect(weekReview([s('2026-11-16', 'no'), s('2026-11-18', 'full')], '2026-11-16', '2026-11-23').question).not.toMatch(/100 %/);
  });
});
