import { describe, expect, it } from 'vitest';
import { PULL_THRESHOLD, pullDistance } from './pull-to-refresh';

// D-180 · Tirer pour actualiser : la distance suit le doigt avec résistance, plafonnée ; un petit geste ne déclenche rien.
describe('tirer vers le bas pour actualiser', () => {
  it('rien en remontant, résistance de moitié, plafond', () => {
    expect(pullDistance(-40)).toBe(0);
    expect(pullDistance(0)).toBe(0);
    expect(pullDistance(60)).toBe(30);
    expect(pullDistance(1000)).toBe(96);
  });
  it('il faut descendre le doigt de 128 px pour actualiser', () => {
    expect(pullDistance(120)).toBeLessThan(PULL_THRESHOLD);
    expect(pullDistance(128)).toBeGreaterThanOrEqual(PULL_THRESHOLD);
  });
});
