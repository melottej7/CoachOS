import { describe, expect, it } from 'vitest';
import { DEFAULT_OFFERS, athleteLimit, billingEnabled, formatPrice, offerFor, offers, standing, trialDays, trialEndForNewWorkspace } from './offers';

describe('offres (D-174)', () => {
  it('reprend les hypothèses de docs/13 sans réglage', () => {
    expect(offers({}).map((o) => [o.id, o.price, o.athletes])).toEqual([['starter', 29, 20], ['pro', 59, 100], ['elite', 99, 300]]);
  });

  it('se corrige champ par champ sans toucher au code', () => {
    const list = offers({ COACHOS_OFFERS: '[{"id":"starter","price":24.9},{"id":"pro","athletes":80,"name":"Club"}]' });
    expect(list[0]).toMatchObject({ id: 'starter', price: 24.9, athletes: 20, name: 'Starter' });
    expect(list[1]).toMatchObject({ id: 'pro', price: 59, athletes: 80, name: 'Club' });
    expect(list[2]).toEqual(DEFAULT_OFFERS[2]);
  });

  it('ignore une correction illisible ou hors bornes', () => {
    expect(offers({ COACHOS_OFFERS: 'pas du json' })).toEqual(DEFAULT_OFFERS);
    expect(offers({ COACHOS_OFFERS: '{"id":"pro"}' })).toEqual(DEFAULT_OFFERS);
    const list = offers({ COACHOS_OFFERS: '[{"id":"pro","price":-5,"athletes":2.5,"name":"  "},{"id":"inconnue","price":1},null]' });
    expect(list).toEqual(DEFAULT_OFFERS);
  });

  it('garde l’interrupteur commercial éteint par défaut', () => {
    expect(billingEnabled({})).toBe(false);
    expect(billingEnabled({ COACHOS_BILLING: 'true' })).toBe(false);
    expect(billingEnabled({ COACHOS_BILLING: '1' })).toBe(true);
  });

  it('borne la durée de l’essai', () => {
    expect(trialDays({})).toBe(30);
    expect(trialDays({ COACHOS_TRIAL_DAYS: '14' })).toBe(14);
    expect(trialDays({ COACHOS_TRIAL_DAYS: '3' })).toBe(30);
    expect(trialDays({ COACHOS_TRIAL_DAYS: 'abc' })).toBe(30);
  });

  it('écrit le prix à la française et choisit l’offre selon le nombre d’élèves', () => {
    expect(formatPrice(29)).toBe('29 €');
    expect(formatPrice(24.9)).toBe('24,90 €');
    expect(offerFor(0, offers({})).id).toBe('starter');
    expect(offerFor(20, offers({})).id).toBe('starter');
    expect(offerFor(21, offers({})).id).toBe('pro');
    expect(offerFor(5000, offers({})).id).toBe('elite');
  });
});

describe('offre d’un espace (D-175)', () => {
  const now = new Date('2026-11-25T10:00:00Z');
  const on = { COACHOS_BILLING: '1' };

  it('reste en phase pilote, sans limite, tant que l’interrupteur est éteint', () => {
    const s = standing({ plan: 'starter', trialEndsAt: new Date('2026-11-01') }, now, {});
    expect(s.kind).toBe('pilot');
    expect(athleteLimit(s)).toBeNull();
    expect(trialEndForNewWorkspace(now, {})).toBeNull();
  });

  it('pose l’essai à la création et en compte les jours', () => {
    const end = trialEndForNewWorkspace(now, on)!;
    expect(end.toISOString()).toBe('2026-12-25T10:00:00.000Z');
    const s = standing({ plan: null, trialEndsAt: end }, now, on);
    expect(s).toMatchObject({ kind: 'trial', daysLeft: 30, offer: { id: 'pro' } });
    expect(athleteLimit(s)).toBe(100);
  });

  it('distingue l’essai terminé, l’offre payée et l’ancien espace pilote', () => {
    expect(standing({ plan: null, trialEndsAt: new Date('2026-11-25T09:00:00Z') }, now, on).kind).toBe('trial_over');
    const paid = standing({ plan: 'starter', trialEndsAt: null }, now, { ...on, COACHOS_OFFERS: '[{"id":"starter","athletes":15}]' });
    expect(paid.kind).toBe('plan');
    expect(athleteLimit(paid)).toBe(15);
    expect(athleteLimit(standing({ plan: null, trialEndsAt: null }, now, on))).toBeNull();
  });
});
