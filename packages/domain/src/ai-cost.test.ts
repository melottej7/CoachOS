import { describe, expect, it } from 'vitest';
import { aiCostMicros, aiMonthlyBudgetMicros, aiReserveMicros, budgetPeriod, formatUsd } from './index';

describe('coût de l’IA (D-081)', () => {
  it('prix par jeton, modèle inconnu estimé, réserve, budget, affichage', () => {
    expect(aiCostMicros('claude-opus-5-5', { input_tokens: 1_000_000, output_tokens: 0 })).toEqual({ micros: 4_000_000, exact: true });
    expect(aiCostMicros('claude-opus-5-5', { input_tokens: 0, output_tokens: 1000, cache_read_input_tokens: 1000 })).toEqual({ micros: 20_200, exact: true });
    expect(aiCostMicros('claude-autre', { input_tokens: 10, output_tokens: 10 }).exact).toBe(false);
    expect(aiReserveMicros(4000, 3000)).toBe(2000 * 4 + 4000 * 20);
    expect([aiMonthlyBudgetMicros(undefined), aiMonthlyBudgetMicros('2.5'), aiMonthlyBudgetMicros('x'), aiMonthlyBudgetMicros('0')]).toEqual([10_000_000, 2_500_000, 10_000_000, 0]);
    expect([formatUsd(0), formatUsd(5000), formatUsd(1_234_567)]).toEqual(['0,00 $', 'moins de 0,01 $', '1,23 $']);
    expect(budgetPeriod(new Date('2026-11-19T23:30:00Z'))).toBe('2026-11-01');
  });
});
