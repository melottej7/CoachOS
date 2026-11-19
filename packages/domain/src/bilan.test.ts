import { describe, expect, it } from 'vitest';
import { athleteProfileSchema, bilanCompletion, bilanSteps, deriveBilan, nextSources, parseWith, resumeStep } from './index';

describe('bilan d’arrivée (D-054)', () => {
  it('les écrans s’adaptent aux réponses, comme dans Foulée', () => {
    expect(bilanSteps({})).toEqual(['sport', 'status', 'experience', 'sessions', 'longest', 'level', 'hours', 'days', 'goal', 'recap']);
    expect(bilanSteps({ practiceStatus: 'resumed' })).toEqual(['sport', 'status', 'experience', 'break', 'resumed', 'sessions', 'longest', 'level', 'hours', 'days', 'goal', 'recap']);
    expect(bilanSteps({ practiceStatus: 'stopped' })).toEqual(['sport', 'status', 'experience', 'break', 'level', 'hours', 'days', 'goal', 'recap']);
    expect(bilanSteps({ practiceStatus: 'beginner' })).toEqual(['sport', 'status', 'sessions', 'longest', 'hours', 'days', 'goal', 'recap']);
  });

  it('réponses déduites, complétude, reprise au premier écran sans réponse', () => {
    const b = deriveBilan({ sport: 'running', practiceStatus: 'beginner', weeklySessions: '2to3' });
    expect(b).toMatchObject({ experience: 'lt1', level: 'beginner' });
    expect(bilanCompletion(b)).toEqual({ answered: 3, total: 3, complete: true });
    const r = { sport: 'cycling' as const, practiceStatus: 'resumed' as const, experience: '3to5' as const };
    expect(bilanCompletion(r)).toEqual({ answered: 3, total: 7, complete: false });
    expect(resumeStep(r)).toBe('break');
    expect(deriveBilan({ practiceStatus: 'stopped', weeklySessions: '4to5' })).toMatchObject({ weeklySessions: '0to1' });
  });

  it('cohérence vérifiée à l’envoi : durée d’arrêt et date de reprise', () => {
    const base = { sport: 'running', level: 'intermediate', experience: '1to3', weeklySessions: '2to3' };
    expect(parseWith(athleteProfileSchema, { ...base, practiceStatus: 'resumed', breakLength: '3to6m' }).ok).toBe(false);
    expect(parseWith(athleteProfileSchema, { ...base, practiceStatus: 'resumed', breakLength: '3to6m', resumedSince: '1to3m' }).ok).toBe(true);
    expect(parseWith(athleteProfileSchema, base).ok).toBe(true); // profils déjà enregistrés sans les nouvelles questions
  });

  it('provenance : les champs modifiés prennent la nouvelle source', () => {
    const prev = { sport: 'running' as const, level: 'intermediate' as const, mainGoal: 'Finir un 10 km' };
    const next = parseWith(athleteProfileSchema, { sport: 'running', level: 'advanced', experience: '1to3', weeklySessions: '2to3', mainGoal: 'Finir un 10 km' });
    if (!next.ok) throw new Error('profil invalide');
    expect(nextSources(prev, next.value, { sport: 'athlete', level: 'athlete', mainGoal: 'athlete' }, 'interview'))
      .toEqual({ sport: 'athlete', level: 'interview', experience: 'interview', weeklySessions: 'interview', mainGoal: 'athlete' });
  });

  it('profil antérieur sans provenance : les réponses inchangées restent déclarées par l’élève', () => {
    const prev = { sport: 'cycling' as const, level: 'intermediate' as const };
    const next = parseWith(athleteProfileSchema, { sport: 'cycling', level: 'intermediate', experience: '1to3', weeklySessions: '2to3', practiceStatus: 'regular' });
    if (!next.ok) throw new Error('profil invalide');
    expect(nextSources({ ...prev, experience: '1to3', weeklySessions: '2to3' }, next.value, {}, 'interview'))
      .toEqual({ sport: 'athlete', level: 'athlete', experience: 'athlete', weeklySessions: 'athlete', practiceStatus: 'interview' });
  });
});

