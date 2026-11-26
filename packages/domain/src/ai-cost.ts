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
  // IA-0 : modèle réglable par COACHOS_AI_MODEL ; Sonnet 5.5, deux fois moins cher, pour essayer.
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
};

const priceOf = (model: string): ModelPrice | null => {
  const key = Object.keys(AI_PRICES).find((k) => model === k || model.startsWith(`${k}-`));
  return key ? AI_PRICES[key]! : null;
};

export interface AiUsage {
  input_tokens: number; output_tokens: number;
  cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
}

/** Coût d’un appel en micro-dollars (arrondi au supérieur), et si le prix du modèle est connu. */
export function aiCostMicros(model: string, u: AiUsage): { micros: number; exact: boolean } {
  const known = priceOf(model);
  const p = known ?? OPUS_5_5;
  const micros = u.input_tokens * p.input + u.output_tokens * p.output
    + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite;
  return { micros: Math.ceil(micros), exact: Boolean(known) };
}

/**
 * Réserve avant l’appel : le pire cas (sortie maximale, entrée estimée à 1 jeton pour 3 caractères, au moins 2 000),
 * au prix du modèle choisi (Opus 5.5 si inconnu, ou s’il est moins cher : un repli peut coûter plus).
 */
export function aiReserveMicros(maxTokens: number, inputChars: number, model?: string): number {
  const known = model ? priceOf(model) : null;
  const p = known && known.output > OPUS_5_5.output ? known : OPUS_5_5;
  const input = Math.max(2000, Math.ceil(inputChars / 3));
  return Math.ceil(input * p.input + maxTokens * p.output);
}

/**
 * IA-0 · Réserve d’un appel avec outils : chaque tour peut produire la sortie maximale et relit tout ce qui précède,
 * entrée de départ plus les résultats d’outils déjà rendus (bornés à `toolResultChars` par tour).
 */
export function aiToolsReserveMicros(maxTokens: number, maxIterations: number, inputChars: number, toolResultChars: number, model?: string): number {
  let total = 0;
  for (let i = 0; i < maxIterations; i++) total += aiReserveMicros(maxTokens, inputChars + i * (toolResultChars + maxTokens * 3), model);
  return total;
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
