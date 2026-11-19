import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import {
  aiCostMicros, aiMonthlyBudgetMicros, aiReserveMicros, budgetPeriod, formatUsd,
  AI_MODEL, AI_PROMPT_VERSION, AI_PROPOSAL_JSON_SCHEMA, AI_SYSTEM_PROMPT, aiProposalSchema, aiUserMessage, aiRequestSchema, parseWith, programTweaksSchema, redactNames, simulateProposal,
  type AiFacts, type AiProposal, type ProgramTweaks,
} from '@coachos/domain';
import { z } from 'zod';
import { commandAs, type Tx } from '../db/client';
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
type Usage = { inputTokens: number; outputTokens: number; costMicros: number; exactPrice: boolean };
const MAX_TOKENS = 4000;

async function askModel(facts: AiFacts, request: string): Promise<{ source: AiSource; model: string; proposal: AiProposal; usage: Usage | null }> {
  if (aiSource() === 'simulation') {
    return { source: 'simulation', model: 'simulation', proposal: aiProposalSchema.parse(simulateProposal(request, facts)), usage: null };
  }
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await anthropic().beta.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS, // réflexion comprise ; la réponse elle-même reste courte (schéma)
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
  // D-081 : coût réel de l’appel, d’après les jetons facturés.
  const billed = response.usage ?? { input_tokens: 0, output_tokens: 0 };
  const cost = aiCostMicros(model, billed);
  const usage: Usage = { inputTokens: billed.input_tokens, outputTokens: billed.output_tokens, costMicros: cost.micros, exactPrice: cost.exact };
  if (response.stop_reason === 'refusal') {
    return { source: 'claude', model, usage, proposal: { status: 'abstain', tweaks: facts.tweaks, days: null, explanation: '', uncertainty: 'L’IA n’a pas pu traiter cette demande. Reformule-la en parlant de séances, de volume ou de jours.' } };
  }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw Object.assign(unavailable('La réponse de l’IA est incomplète.'), { usage }); }
  // Validation complète (bornes comprises) : rien d’autre que des réglages autorisés n’atteint le moteur.
  const ok = aiProposalSchema.safeParse(parsed);
  if (!ok.success) throw Object.assign(unavailable('La réponse de l’IA ne respecte pas les réglages autorisés.'), { usage });
  return { source: 'claude', model, proposal: ok.data, usage };
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
  // D-081 : budget mensuel de l’espace. Le pire cas est réservé avant l’appel, le coût réel remplace la réserve après.
  const reserve = aiSource() === 'claude' ? aiReserveMicros(MAX_TOKENS, AI_SYSTEM_PROMPT.length + aiUserMessage(facts, request).length) : 0;
  const period = budgetPeriod(new Date());
  if (reserve) await reserveBudget(wid, meta.actorId, period, reserve);
  let answer: Awaited<ReturnType<typeof askModel>>;
  try {
    answer = await askModel(facts, request);
  } catch (e) {
    if (reserve) await settleBudget(wid, meta.actorId, period, reserve, (e as { usage?: Usage }).usage?.costMicros ?? 0);
    throw e;
  }
  if (reserve) await settleBudget(wid, meta.actorId, period, reserve, answer.usage?.costMicros ?? 0);
  const hash = createHash('sha256').update(JSON.stringify({ facts, request, v: AI_PROMPT_VERSION })).digest('hex');

  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, aid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'ai.tweaks', key: meta.idempotencyKey, body: { aid, goalId, ...v } }, async () => {
      const r = await tx.query<{ id: string }>(
        `insert into public.ai_suggestions(workspace_id, athlete_id, coach_id, module, state, model_id, prompt_version, evidence_hash, evidence_refs, output)
         values ($1, $2, auth.uid(), 'adaptation', 'ready', $3, $4, $5, '[]'::jsonb, $6::jsonb) returning id`,
        [wid, aid, answer.model, AI_PROMPT_VERSION, hash, JSON.stringify({ goalId, request, facts, source: answer.source, proposal: answer.proposal, usage: answer.usage })],
      );
      await audit(tx, wid, meta.actorId, 'ai.tweaks', r.rows[0]!.id, meta.requestId);
      return { status: 200, body: { suggestionId: r.rows[0]!.id, source: answer.source, proposal: answer.proposal } };
    });
  });
}

const budgetMicros = () => aiMonthlyBudgetMicros(process.env.COACHOS_AI_MONTHLY_BUDGET_USD);

/** Réserve le pire cas sur le budget du mois ; refuse si le budget serait dépassé (rien n’est appelé). */
async function reserveBudget(wid: string, actorId: string, period: string, micros: number): Promise<void> {
  const ok = await commandAs(actorId, async (tx: Tx) => {
    await tx.query(
      `insert into public.ai_budget(workspace_id, period_start, budget_micros) values ($1, $2::date, $3) on conflict (workspace_id, period_start) do update set budget_micros = excluded.budget_micros`,
      [wid, period, budgetMicros()],
    );
    const r = await tx.query(
      `update public.ai_budget set reserved_micros = reserved_micros + $3 where workspace_id = $1 and period_start = $2::date and spent_micros + reserved_micros + $3 <= budget_micros returning 1`,
      [wid, period, micros],
    );
    return r.rows.length > 0;
  });
  if (!ok) {
    console.error(JSON.stringify({ module: 'ai', code: 'budget' }));
    throw new AppError('TEMPORARILY_UNAVAILABLE', `Le budget IA du mois est atteint (${formatUsd(budgetMicros())}). Tu peux régler le programme à la main, ou relever le budget (COACHOS_AI_MONTHLY_BUDGET_USD dans les réglages du serveur).`);
  }
}

/** Remplace la réserve par le coût réel (zéro si l’appel a échoué avant facturation). */
async function settleBudget(wid: string, actorId: string, period: string, reserved: number, spent: number): Promise<void> {
  await commandAs(actorId, (tx: Tx) => tx.query(
    `update public.ai_budget set reserved_micros = greatest(0, reserved_micros - $3), spent_micros = spent_micros + $4 where workspace_id = $1 and period_start = $2::date`,
    [wid, period, reserved, spent],
  ));
}

export interface AiMonth { period: string; budgetMicros: number; spentMicros: number; calls: number; claudeCalls: number }

/** Consommation du mois pour l’espace (Paramètres) : propositions faites, coût réel, budget. */
export async function aiMonth(actorId: string, wid: string, now = new Date()): Promise<AiMonth> {
  const period = budgetPeriod(now);
  return commandAs(actorId, async (tx: Tx) => {
    const b = await tx.query<{ spent_micros: string }>(`select spent_micros from public.ai_budget where workspace_id = $1 and period_start = $2::date`, [wid, period]);
    const c = await tx.query<{ calls: string; claude: string }>(
      `select count(*) as calls, count(*) filter (where output->>'source' = 'claude') as claude from public.ai_suggestions
       where workspace_id = $1 and created_at >= $2::date and created_at < ($2::date + interval '1 month')`, [wid, period],
    );
    return { period, budgetMicros: budgetMicros(), spentMicros: Number(b.rows[0]?.spent_micros ?? 0), calls: Number(c.rows[0]?.calls ?? 0), claudeCalls: Number(c.rows[0]?.claude ?? 0) };
  });
}
