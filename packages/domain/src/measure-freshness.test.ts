import { describe, expect, it } from 'vitest';
import { measureFreshness } from './index';

// D-075 : source, période et fraîcheur des mesures.

describe('fraîcheur des mesures (D-075)', () => {
  const today = '2026-11-19';
  it('montre récente et retours mêlés', () => {
    const r = measureFreshness({ windowDays: 30, lastActivity: { date: '2026-11-17', format: 'tcx' }, activities: 3, feedbacks: 4, fromWatch: 2, lastFeedback: '2026-11-18' }, today);
    expect(r.lines).toEqual([
      'Montre : dernière activité importée il y a 2 jours (TCX) · 3 activités sur 30 jours.',
      'Retours : 4 sur 30 jours, dont 2 mesurés par la montre et 2 saisis à la main.',
    ]);
    expect(r.stale).toBe(false);
  });
  it('saisie à la main seulement ; rien depuis plus de 14 jours ; rien du tout', () => {
    expect(measureFreshness({ windowDays: 30, lastActivity: null, activities: 0, feedbacks: 1, fromWatch: 0, lastFeedback: '2026-11-01' }, today))
      .toEqual({ stale: true, lines: ['Montre : aucune activité importée ; les mesures viennent de la saisie à la main.', 'Retours : 1 sur 30 jours, dont 0 mesuré par la montre et 1 saisi à la main.', 'Rien de nouveau depuis 18 jours : les chiffres de la fiche datent.'] });
    expect(measureFreshness({ windowDays: 30, lastActivity: null, activities: 0, feedbacks: 0, fromWatch: 0, lastFeedback: null }, today).lines.at(-1)).toMatch(/^Aucune mesure/);
  });
});
