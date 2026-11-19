/**
 * Coût de l’IA (D-081, COUVERTURE § 6 « coûts suivis », table ai_budget du SQL de référence).
 * Prix publics d’Anthropic en dollars par million de jetons, convertis en micro-dollars par jeton
 * (1 $ / million de jetons = 1 micro-dollar par jeton). Source : documentation Anthropic (novembre 2026).
 * Un modèle inconnu (modèle de secours) est compté au prix d’Opus 5.5 et signalé comme estimation.
 */

export interface ModelPrice { input: number; output: number; cacheRead: number; cacheWrite: number }

const OPUS_5_5: ModelPrice = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };
export const AI_PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': OPUS_5_5,
};

export interface AiUsage {
  input_tokens: number; output_tokens: number;
  cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
}

/** Coût d’un appel en micro-dollars (arrondi au supérieur), et si le prix du modèle est connu. */
export function aiCostMicros(model: string, u: AiUsage): { micros: number; exact: boolean } {
  const key = Object.keys(AI_PRICES).find((k) => model === k || model.startsWith(`${k}-`));
  const p = key ? AI_PRICES[key]! : OPUS_5_5;
  const micros = u.input_tokens * p.input + u.output_tokens * p.output
    + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite;
  return { micros: Math.ceil(micros), exact: Boolean(key) };
}

/** Réserve avant l’appel : le pire cas (sortie maximale, entrée estimée à 1 jeton pour 3 caractères, au moins 2 000). */
export function aiReserveMicros(maxTokens: number, inputChars: number): number {
  const input = Math.max(2000, Math.ceil(inputChars / 3));
  return Math.ceil(input * OPUS_5_5.input + maxTokens * OPUS_5_5.output);
}

/** Budget mensuel par espace (dollars) : variable COACHOS_AI_MONTHLY_BUDGET_USD, 10 $ par défaut. */
export function aiMonthlyBudgetMicros(env: string | undefined): number {
  const n = Number(env);
  return Math.round((Number.isFinite(n) && n >= 0 && env !== undefined && env !== '' ? n : 10) * 1_000_000);
}

/** « 0,12 $ » ; sous un centime : « moins de 0,01 $ ». */
export function formatUsd(micros: number): string {
  if (micros > 0 && micros < 10_000) return 'moins de 0,01 $';
  return `${(micros / 1_000_000).toFixed(2).replace('.', ',')} $`;
}

/** Premier jour du mois (UTC) d’un instant : la période du budget. */
export function budgetPeriod(at: Date): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
