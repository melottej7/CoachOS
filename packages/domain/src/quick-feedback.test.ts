import { describe, expect, it } from 'vitest';
import { saveFeedbackSchema } from './feedback';
import { effortGap, quickFeedbackBody, sessionIntent } from './quick-feedback';
import type { Block } from './structure';

const step = (phase: string, intensity: object): Block => ({ type: 'step', phase, sport: null, measure: { kind: 'time', seconds: 600 }, intensity, cadence: null, note: null } as unknown as Block);

describe('intention de séance et écart de ressenti (D-039)', () => {
  it('prend l’intensité la plus haute des blocs de travail, répétitions comprises', () => {
    const easy = [step('warmup', { kind: 'zone', zone: 1 }), step('work', { kind: 'zone', zone: 2 })];
    expect(sessionIntent(easy)).toBe('easy');
    const intervals: Block[] = [step('warmup', { kind: 'zone', zone: 2 }), { type: 'repeat', times: 6, steps: [step('work', { kind: 'zone', zone: 6 }), step('recovery', { kind: 'zone', zone: 1 })] }];
    expect(sessionIntent(intervals)).toBe('hard');
    expect(sessionIntent([step('work', { kind: 'rpe', min: 5, max: 6 })])).toBe('moderate');
    expect(sessionIntent([step('work', { kind: 'none' })])).toBeNull();
    expect(sessionIntent([])).toBeNull();
  });

  it('compare le ressenti à l’intention', () => {
    expect(effortGap('easy', 8)).toBe(1);
    expect(effortGap('easy', 4)).toBe(0);
    expect(effortGap('hard', 4)).toBe(-1);
    expect(effortGap(null, 8)).toBeNull();
    expect(effortGap('easy', null)).toBeNull();
  });

  it('le retour rapide est un retour valide, sans ressenti pour une séance pas faite', () => {
    expect(saveFeedbackSchema.safeParse(quickFeedbackBody(2, 'completed', 6)).success).toBe(true);
    expect(saveFeedbackSchema.safeParse(quickFeedbackBody(1, 'partial', null)).success).toBe(true);
    expect(quickFeedbackBody(1, 'missed', 8).rpe).toBeNull();
    expect(saveFeedbackSchema.safeParse(quickFeedbackBody(1, 'missed', 8)).success).toBe(true);
  });
});
