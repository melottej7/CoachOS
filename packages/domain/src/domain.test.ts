import { describe, expect, it } from 'vitest';
import {
  addDays,
  canGiveFeedback,
  formatWeekRange,
  parseWith,
  saveFeedbackSchema,
  todayIn,
  weekDates,
  weekStart,
  workoutInputSchema,
  workoutStatus,
  safeNext,
} from './index';

describe('dates locales', () => {
  it('lundi de la semaine, stable autour du changement d’heure (C04-01)', () => {
    // 25 octobre 2026 : passage à l’heure d’hiver en Europe.
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekDates('2026-10-19')).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(weekStart('2026-03-29')).toBe('2026-03-23');
  });

  it('date du jour selon le fuseau de l’athlète', () => {
    const lateUtc = new Date('2026-11-17T23:30:00Z');
    expect(todayIn('Europe/Brussels', lateUtc)).toBe('2026-11-18');
    expect(todayIn('America/Montreal', lateUtc)).toBe('2026-11-17');
  });

  it('libellé de semaine', () => {
    expect(formatWeekRange('2026-11-16')).toBe('16–22 novembre 2026');
    expect(formatWeekRange('2026-11-30')).toMatch(/^30 nov\. – 6 déc\. 2026$/);
  });
});

describe('séance', () => {
  const base = { localDate: '2026-11-17', timeZone: 'Europe/Brussels', sport: 'running', title: '  Footing  ' };

  it('normalise le titre et les consignes vides', () => {
    const r = parseWith(workoutInputSchema, { ...base, instructions: '   ' });
    expect(r.ok && r.value.title).toBe('Footing');
    expect(r.ok && r.value.instructions).toBeNull();
  });

  it('refuse sport inconnu, date invalide, fuseau inconnu, propriété inconnue', () => {
    const r = parseWith(workoutInputSchema, { ...base, sport: 'golf', localDate: '2026-02-30', timeZone: 'Mars/Olympus', extra: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fields.map((f) => f.path).sort()).toEqual(['(body)', 'localDate', 'sport', 'timeZone']);
  });

  it('distingue brouillon, publié et modifié', () => {
    expect(workoutStatus(1, null)).toBe('draft');
    expect(workoutStatus(2, 2)).toBe('published');
    expect(workoutStatus(3, 2)).toBe('changed');
  });

  it('retour ouvert à partir du jour de la séance', () => {
    expect(canGiveFeedback('2026-11-17', '2026-11-17', false)).toBe(true);
    expect(canGiveFeedback('2026-11-18', '2026-11-17', false)).toBe(false);
    expect(canGiveFeedback('2026-11-16', '2026-11-17', true)).toBe(false);
  });
});

describe('retour athlète', () => {
  it('RPE entier 0 à 10, absence acceptée (C06-04)', () => {
    expect(parseWith(saveFeedbackSchema, { publishedRevision: 1, state: 'completed', rpe: 0 }).ok).toBe(true);
    expect(parseWith(saveFeedbackSchema, { publishedRevision: 1, state: 'completed' }).ok).toBe(true);
    expect(parseWith(saveFeedbackSchema, { publishedRevision: 1, state: 'completed', rpe: 11 }).ok).toBe(false);
    expect(parseWith(saveFeedbackSchema, { publishedRevision: 1, state: 'completed', rpe: 4.5 }).ok).toBe(false);
  });

  it('séance manquée sans durée supposée', () => {
    expect(parseWith(saveFeedbackSchema, { publishedRevision: 1, state: 'missed', durationSeconds: 600 }).ok).toBe(false);
  });

  it('commentaire vide normalisé en null', () => {
    const r = parseWith(saveFeedbackSchema, { publishedRevision: 1, state: 'partial', comment: '  ' });
    expect(r.ok && r.value.comment).toBeNull();
  });
});

describe('redirection après connexion (C02-09)', () => {
  it('garde un chemin local', () => {
    expect(safeNext('/coach/abc/review?from=calendar')).toBe('/coach/abc/review?from=calendar');
  });
  it('écarte toute destination externe ou ambiguë', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'evil', '/a\\b', '/a\nb', null, '']) {
      expect(safeNext(bad as string | null)).toBe('/');
    }
  });
});

describe('mois du programme', async () => {
  const { addMonths, monthStart, monthWeeks, formatMonth } = await import('./dates');
  it('calcule le mois, ses semaines et son libellé', () => {
    expect(monthStart('2026-11-18')).toBe('2026-11-01');
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    // Novembre 2026 : du lundi 26 octobre au dimanche 6 décembre, 6 semaines.
    expect(monthWeeks('2026-11-01')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
    expect(formatMonth('2026-11-01')).toBe('novembre 2026');
  });
});
