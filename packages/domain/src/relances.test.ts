import { describe, expect, it } from 'vitest';
import { adherenceOf, DEFAULT_RELANCE_TEMPLATES, fillRelance, relanceDraft, unknownPlaceholders, type AdherenceInput, type RecentSession } from './index';

// D-103 : statut d’adhésion par règles lisibles, relance proposée, brouillons sans question de santé.

const today = '2026-11-21';
const s = (date: string, state: RecentSession['state'], title = 'Footing 30′'): RecentSession => ({ id: `w-${date}`, date, title, state });
const base: AdherenceInput = { today, recent: [], lastFeedbackOn: null, lastAthleteMessageOn: null, lastCoachMessageOn: null, readiness: null, upcoming7: 2 };

describe('statut d’adhésion', () => {
  it('silencieux : au moins 2 séances et 7 jours sans retour ni message', () => {
    const a = adherenceOf({ ...base, recent: [s('2026-11-10', 'completed'), s('2026-11-14', null), s('2026-11-17', null)], lastFeedbackOn: '2026-11-11' });
    expect(a).toMatchObject({ status: 'silent', relance: 'silent', silentDays: 10, waitingSince: null });
    expect(a.reason).toBe('Aucune nouvelle depuis 10 jours (2 séances sans retour ces 7 derniers jours)');
    // Un message de l’élève compte comme une nouvelle.
    expect(adherenceOf({ ...base, recent: [s('2026-11-10', 'completed'), s('2026-11-17', null)], lastFeedbackOn: '2026-11-11', lastAthleteMessageOn: '2026-11-19' }).status).not.toBe('silent');
  });
  it('à risque : pas à 100 % depuis moins de 14 jours, ou 2 séances sans nouvelle cette semaine', () => {
    expect(adherenceOf({ ...base, recent: [s('2026-11-19', 'completed')], lastFeedbackOn: '2026-11-19', readiness: { value: 'not_quite', on: '2026-11-19' } }))
      .toMatchObject({ status: 'at_risk', relance: 'readiness', reason: 'Pas tout à fait à 100 % depuis le 19/11' });
    expect(adherenceOf({ ...base, recent: [s('2026-11-19', 'completed')], lastFeedbackOn: '2026-11-19', readiness: { value: 'not_quite', on: '2026-11-01' } }).status).toBe('on_track');
    const m = adherenceOf({ ...base, recent: [s('2026-11-15', 'missed'), s('2026-11-17', null, 'Fractionné'), s('2026-11-18', 'completed')], lastFeedbackOn: '2026-11-18' });
    expect(m).toMatchObject({ status: 'at_risk', relance: 'missed', reason: '2 séances sur 3 sans retour ou non faites ces 7 derniers jours' });
    expect(m.workout?.title).toBe('Fractionné');
  });
  it('à surveiller : une séance sans retour après 2 jours (pas avant) ; en rythme et encouragement ; sans séance', () => {
    expect(adherenceOf({ ...base, recent: [s('2026-11-18', 'completed'), s('2026-11-19', null, 'Côtes')], lastFeedbackOn: '2026-11-18' }))
      .toMatchObject({ status: 'watch', relance: 'no_feedback', reason: 'Pas de retour sur « Côtes »' });
    expect(adherenceOf({ ...base, recent: [s('2026-11-18', 'completed'), s('2026-11-20', null)], lastFeedbackOn: '2026-11-18' }).status).toBe('on_track');
    expect(adherenceOf({ ...base, recent: [s('2026-11-16', 'completed'), s('2026-11-18', 'partial')], lastFeedbackOn: '2026-11-18' }))
      .toMatchObject({ status: 'on_track', relance: 'bravo', done7: 2, due7: 2 });
    expect(adherenceOf({ ...base, upcoming7: 0 })).toMatchObject({ status: 'no_plan', relance: null });
  });
  it('relance envoyée : en attente de réponse pendant 3 jours, puis de nouveau à faire', () => {
    const x = { ...base, recent: [s('2026-11-10', 'completed'), s('2026-11-17', null)], lastFeedbackOn: '2026-11-11' };
    expect(adherenceOf({ ...x, lastCoachMessageOn: '2026-11-20' }).waitingSince).toBe('2026-11-20');
    expect(adherenceOf({ ...x, lastCoachMessageOn: '2026-11-16' }).waitingSince).toBeNull();
    // Un message du coach plus ancien que le dernier contact ne compte pas comme relance.
    expect(adherenceOf({ ...x, lastCoachMessageOn: '2026-11-09' }).waitingSince).toBeNull();
  });
});

describe('brouillons de relance', () => {
  it('prénom, séance, nombre de jours ; aucune question de santé', () => {
    expect(relanceDraft('silent', { first: 'Emma', silentDays: 9 })).toContain('Salut Emma ! Je n’ai pas eu de nouvelles depuis 9 jours');
    expect(relanceDraft('no_feedback', { first: 'Emma', workout: s('2026-11-19', null, 'Côtes 8 × 30″') })).toContain('« Côtes 8 × 30″ » de jeudi');
    expect(relanceDraft('missed', { first: 'Emma', workout: s('2026-11-17', 'missed', 'Fractionné') })).toContain('« Fractionné » (mardi) n’a pas pu se faire');
    expect(relanceDraft('bravo', { first: 'Emma', done7: 3, due7: 3 })).toBe('Bravo Emma ! 3 séances sur 3 cette semaine, c’est top. Continue comme ça 👏');
    for (const k of ['silent', 'readiness', 'missed', 'no_feedback', 'bravo'] as const) {
      expect(relanceDraft(k, { first: 'Emma' })).not.toMatch(/douleur|blessure|mal |médic|santé/i);
    }
  });
});

describe('modèles de relance du coach (D-104)', () => {
  it('trous remplis, avec ou sans accent ; repli lisible ; trou inconnu gardé et signalé', () => {
    const w = s('2026-11-17', null, 'Côtes');
    expect(fillRelance('Yo {prénom}, ta {seance} de {jour} ? {jours} j sans news. {faites}/{prévues}', { first: 'Léo', workout: w, silentDays: 8, done7: 1, due7: 3 }))
      .toBe('Yo Léo, ta Côtes de mardi ? 8 j sans news. 1/3');
    expect(fillRelance('« {séance} » {jour}', { first: 'Léo' })).toBe('« ta dernière séance » ces derniers jours');
    expect(fillRelance('Salut {pseudo} !', { first: 'Léo' })).toBe('Salut {pseudo} !');
    expect(unknownPlaceholders('Salut {prénom} {pseudo} {Jour}')).toEqual(['pseudo']);
    expect(Object.values(DEFAULT_RELANCE_TEMPLATES).flatMap(unknownPlaceholders)).toEqual([]);
  });
  it('le modèle du coach remplace celui de CoachOS', () => {
    expect(relanceDraft('silent', { first: 'Emma', silentDays: 9 }, 'Hey {prénom}, tortue mood 🐢 ? {jours} jours !')).toBe('Hey Emma, tortue mood 🐢 ? 9 jours !');
    expect(relanceDraft('bravo', { first: 'Emma', done7: 1, due7: 1 })).toContain('1 séance sur 1');
  });
});
