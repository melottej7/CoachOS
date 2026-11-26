import Anthropic from '@anthropic-ai/sdk';
import { AI_FALLBACK_MODELS, aiModelFrom } from '@coachos/domain';
import { AppError } from '../errors';

/**
 * IA-0 · Client unique du modèle, partagé par toutes les fonctions IA de CoachOS (MARCHE_IA.md).
 * Claude quand ANTHROPIC_API_KEY est défini (apps/web/.env.local, Vercel) ; sinon, ou avec COACHOS_AI=simulation,
 * l’IA simulée : mêmes réponses validées, aucune donnée ne sort, aucun coût.
 */

export type AiSource = 'simulation' | 'claude';

/** Fournisseur actif (carte « Ajuster avec l’IA », Paramètres › IA, /api/health). */
export function aiSource(): AiSource {
  return process.env.ANTHROPIC_API_KEY && process.env.COACHOS_AI !== 'simulation' ? 'claude' : 'simulation';
}

/** Modèle demandé : COACHOS_AI_MODEL, sinon claude-opus-5-5. */
export const aiModel = (): string => aiModelFrom(process.env.COACHOS_AI_MODEL);

/** Repli serveur (`fallbacks: "default"`) seulement pour les modèles qui l’acceptent. */
export const fallbackParams = (model: string): { betas?: string[]; fallbacks?: 'default' } =>
  (AI_FALLBACK_MODELS as readonly string[]).includes(model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {};

let client: Anthropic | null = null;
/** Tests : remplacer le client (aucun appel réel, aucun coût). */
export function setAnthropicClient(c: Anthropic | null): void { client = c; }
/** Délai court (docs/08 : 20 s) et une seule nouvelle tentative : le coach attend devant l’écran. */
export const anthropic = (): Anthropic => (client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 }));

/** « L’IA n’est pas disponible », avec la voie manuelle propre à l’usage (`manual`, sans point final). */
export const unavailable = (why: string, manual: string) => new AppError('TEMPORARILY_UNAVAILABLE', `${why} ${manual} ou réessayer.`);

/** Erreurs du SDK traduites pour le coach. Journal technique sans contenu : type d’erreur et statut seulement. */
export function apiFailure(e: unknown, manual: string): unknown {
  if (e instanceof Anthropic.AuthenticationError) { console.error(JSON.stringify({ module: 'ai', code: 'auth' })); return unavailable('La clé de l’IA est refusée (à vérifier dans les réglages du serveur).', manual); }
  if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) {
    console.error(JSON.stringify({ module: 'ai', code: 'no_credit' }));
    return unavailable('Le compte IA n’a plus de crédit (à recharger dans la console Anthropic, rubrique facturation).', manual);
  }
  if (e instanceof Anthropic.RateLimitError) return unavailable('L’IA est très sollicitée en ce moment.', manual);
  if (e instanceof Anthropic.APIConnectionError) return unavailable('L’IA ne répond pas.', manual);
  if (e instanceof Anthropic.APIError) { console.error(JSON.stringify({ module: 'ai', code: 'api', status: e.status })); return unavailable('L’IA a renvoyé une erreur.', manual); }
  return e;
}
