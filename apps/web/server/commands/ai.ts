import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  AI_MODEL, AI_PROMPT_VERSION, AI_PROPOSAL_JSON_SCHEMA, AI_SYSTEM_PROMPT, aiProposalSchema, aiUserMessage, aiRequestSchema, parseWith, programTweaksSchema, redactNames, simulateProposal,
  type AiFacts, type AiProposal, type ProgramTweaks,
} from '@coachos/domain';
import { z } from 'zod';
import { commandAs } from '../db/client';
import { AppError, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned } from './portfolio';
import { programContext } from './programs';

/**
 * « Ajuster avec l’IA » (D-071). Le coach écrit sa demande ; on envoie au modèle des faits structurés et la demande
 * sans le nom de l’élève ; la réponse est validée (schéma) puis tracée dans ai_suggestions (module « adaptation »).
 * Le moteur construit ensuite le programme avec ces réglages ; le coach voit les différences et décide.
 *
 * Fournisseur : Claude (claude-opus-5-5) quand ANTHROPIC_API_KEY est défini dans apps/web/.env.local ;
 * sinon, ou avec COACHOS_AI=simulation, l’IA simulée (mêmes réponses validées, aucune donnée ne sort).
 */

const bodySchema = aiRequestSchema.extend({
  days: z.array(z.number().int().min(1).max(7)).min(2).max(6),
  tweaks: programTweaksSchema.nullish().transform((v) => v ?? null),
}).strict();

export type AiSource = 'simulation' | 'claude';

/** Fournisseur actif, affiché sur la carte « Ajuster avec l’IA ». */
export function aiSource(): AiSource {
  return process.env.ANTHROPIC_API_KEY && process.env.COACHOS_AI !== 'simulation' ? 'claude' : 'simulation';
}

let client: Anthropic | null = null;
/** Tests : remplacer le client (aucun appel réel, aucun coût). */
export function setAnthropicClient(c: Anthropic | null): void { client = c; }
/** Délai court (docs/08 : 20 s) et une seule nouvelle tentative : le coach attend devant l’écran. */
const anthropic = () => (client ??= new Anthropic({ timeout: 20_000, maxRetries: 1 }));

const unavailable = (why: string) => new AppError('TEMPORARILY_UNAVAILABLE', `${why} Tu peux régler le programme à la main (jours, premier lundi) ou réessayer.`);

/** Seul point d’appel du modèle. Sans clé : simulation déterministe (même forme, même validation). */
async function askModel(facts: AiFacts, request: string): Promise<{ source: AiSource; model: string; proposal: AiProposal }> {
  if (aiSource() === 'simulation') {
    return { source: 'simulation', model: 'simulation', proposal: aiProposalSchema.parse(simulateProposal(request, facts)) };
  }
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await anthropic().beta.messages.create({
      model: AI_MODEL,
      max_tokens: 4000, // réflexion comprise ; la réponse elle-même reste courte (schéma)
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // si le modèle décline, l’API relance sur un modèle de secours (D-071)
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: aiUserMessage(facts, request) }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: AI_PROPOSAL_JSON_SCHEMA } },
    });
  } catch (e) {
    // Journal technique sans contenu : type d’erreur et statut seulement.
    if (e instanceof Anthropic.AuthenticationError) { console.error(JSON.stringify({ module: 'ai', code: 'auth' })); throw unavailable('La clé de l’IA est refusée (à vérifier dans les réglages du serveur).'); }
    if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) {
      console.error(JSON.stringify({ module: 'ai', code: 'no_credit' }));
      throw unavailable('Le compte IA n’a plus de crédit (à recharger dans la console Anthropic, rubrique facturation).');
    }
    if (e instanceof Anthropic.RateLimitError) throw unavailable('L’IA est très sollicitée en ce moment.');
    if (e instanceof Anthropic.APIConnectionError) throw unavailable('L’IA ne répond pas.');
    if (e instanceof Anthropic.APIError) { console.error(JSON.stringify({ module: 'ai', code: 'api', status: e.status })); throw unavailable('L’IA a renvoyé une erreur.'); }
    throw e;
  }
  const model = response.model;
  if (response.stop_reason === 'refusal') {
    return { source: 'claude', model, proposal: { status: 'abstain', tweaks: facts.tweaks, days: null, explanation: '', uncertainty: 'L’IA n’a pas pu traiter cette demande. Reformule-la en parlant de séances, de volume ou de jours.' } };
  }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw unavailable('La réponse de l’IA est incomplète.'); }
  // Validation complète (bornes comprises) : rien d’autre que des réglages autorisés n’atteint le moteur.
  const ok = aiProposalSchema.safeParse(parsed);
  if (!ok.success) throw unavailable('La réponse de l’IA ne respecte pas les réglages autorisés.');
  return { source: 'claude', model, proposal: ok.data };
}

/** proposeProgramTweaks · C : proposition de réglages pour le programme d’un objectif (rien n’est modifié). */
export async function proposeProgramTweaks(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; athleteId: string; goalId: string }, body: unknown): Promise<StoredResponse> {
  const p = parseWith(bodySchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as { text: string; days: number[]; tweaks: ProgramTweaks | null };
  const { workspaceId: wid, athleteId: aid, goalId } = meta;
  const ctx = await programContext(meta.actorId, wid, aid, goalId);
  if (!ctx) throw notVisible();
  if (!ctx.feasibility) throw invalid([{ path: 'goalId', rule: 'Le bilan de l’élève est nécessaire' }]);
  const tweaks = v.tweaks ?? programTweaksSchema.parse({});
  const facts: AiFacts = {
    sport: ctx.goal.sport, distanceKm: ctx.feasibility.distanceKm, level: ctx.feasibility.level,
    weeks: Math.max(1, Math.round((Date.parse(`${ctx.feasibility.eventDate}T12:00:00Z`) - Date.parse(`${ctx.today}T12:00:00Z`)) / (7 * 86_400_000))),
    days: v.days, tweaks,
  };
  const request = redactNames(v.text, [ctx.athlete.name]);
  const answer = await askModel(facts, request);
  const hash = createHash('sha256').update(JSON.stringify({ facts, request, v: AI_PROMPT_VERSION })).digest('hex');

  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, aid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'ai.tweaks', key: meta.idempotencyKey, body: { aid, goalId, ...v } }, async () => {
      const r = await tx.query<{ id: string }>(
        `insert into public.ai_suggestions(workspace_id, athlete_id, coach_id, module, state, model_id, prompt_version, evidence_hash, evidence_refs, output)
         values ($1, $2, auth.uid(), 'adaptation', 'ready', $3, $4, $5, '[]'::jsonb, $6::jsonb) returning id`,
        [wid, aid, answer.model, AI_PROMPT_VERSION, hash, JSON.stringify({ goalId, request, facts, source: answer.source, proposal: answer.proposal })],
      );
      await audit(tx, wid, meta.actorId, 'ai.tweaks', r.rows[0]!.id, meta.requestId);
      return { status: 200, body: { suggestionId: r.rows[0]!.id, source: answer.source, proposal: answer.proposal } };
    });
  });
}
