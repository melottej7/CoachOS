import {
  AI_PROMPT_VERSION, AI_PROPOSAL_JSON_SCHEMA, AI_SYSTEM_PROMPT, aiProposalSchema, aiUserMessage, aiRequestSchema, parseWith, programTweaksSchema, redactNames, simulateProposal,
  type AiFacts, type AiProposal, type ProgramTweaks,
} from '@coachos/domain';
import { z } from 'zod';
import { askStructured, AI_COULD_NOT, evidenceHash, recordSuggestion } from '../ai/call';
import { commandAs } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned } from './portfolio';
import { programContext } from './programs';

// IA-0 : client, budget et consommation vivent dans le module commun (server/ai) ; réexportés ici pour les pages.
export { aiSource, setAnthropicClient, type AiSource } from '../ai/client';
export { aiMonth, type AiMonth } from '../ai/budget';

/**
 * « Ajuster avec l’IA » (D-071). Le coach écrit sa demande ; on envoie au modèle des faits structurés et la demande
 * sans le nom de l’élève ; la réponse est validée (schéma) puis tracée dans ai_suggestions (module « adaptation »).
 * Le moteur construit ensuite le programme avec ces réglages ; le coach voit les différences et décide.
 * Appel par le socle commun (IA-0) : effort « low », sortie structurée, budget, repli serveur, simulation sans clé.
 */

const bodySchema = aiRequestSchema.extend({
  days: z.array(z.number().int().min(1).max(7)).min(2).max(6),
  tweaks: programTweaksSchema.nullish().transform((v) => v ?? null),
}).strict();

const MAX_TOKENS = 4000; // réflexion comprise ; la réponse elle-même reste courte (schéma)
const MANUAL = 'Tu peux régler le programme à la main (jours, premier lundi)';

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
  const answer = await askStructured<AiProposal>({
    actorId: meta.actorId, workspaceId: wid, manual: MANUAL, effort: 'low', maxTokens: MAX_TOKENS,
    system: AI_SYSTEM_PROMPT, user: aiUserMessage(facts, request),
    jsonSchema: AI_PROPOSAL_JSON_SCHEMA as unknown as Record<string, unknown>, schema: aiProposalSchema,
    simulate: () => simulateProposal(request, facts),
  });
  // Refus ou réponse tronquée : abstention, réglages inchangés, rien n’est appliqué.
  const proposal: AiProposal = answer.output ?? { status: 'abstain', tweaks: facts.tweaks, days: null, explanation: '', uncertainty: `${AI_COULD_NOT} Reformule-la en parlant de séances, de volume ou de jours.` };
  const hash = evidenceHash({ facts, request, v: AI_PROMPT_VERSION });

  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, aid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'ai.tweaks', key: meta.idempotencyKey, body: { aid, goalId, ...v } }, async () => {
      const id = await recordSuggestion(tx, {
        workspaceId: wid, athleteId: aid, module: 'adaptation', model: answer.model, promptVersion: AI_PROMPT_VERSION, hash,
        output: { goalId, request, facts, source: answer.source, proposal, usage: answer.usage, declined: answer.declined },
      });
      await audit(tx, wid, meta.actorId, 'ai.tweaks', id, meta.requestId);
      return { status: 200, body: { suggestionId: id, source: answer.source, proposal } };
    });
  });
}
