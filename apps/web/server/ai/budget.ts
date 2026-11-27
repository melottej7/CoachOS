import { aiMonthlyBudgetMicros, budgetPeriod, formatUsd } from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { AppError } from '../errors';

/**
 * D-081 · Budget mensuel de l’espace. Le pire cas est réservé avant l’appel ; le coût réel (tous les tours d’outils
 * compris) remplace la réserve après, même en cas d’échec (zéro si rien n’a été facturé).
 */

export const budgetMicros = () => aiMonthlyBudgetMicros(process.env.COACHOS_AI_MONTHLY_BUDGET_USD);

/** Réserve le pire cas sur le budget du mois ; refuse si le budget serait dépassé (rien n’est appelé). */
export async function reserveBudget(wid: string, actorId: string, period: string, micros: number, manual: string): Promise<void> {
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
    throw new AppError('TEMPORARILY_UNAVAILABLE', `Le budget IA du mois est atteint (${formatUsd(budgetMicros())}). ${manual}, ou relever le budget (COACHOS_AI_MONTHLY_BUDGET_USD dans les réglages du serveur).`);
  }
}

/** Remplace la réserve par le coût réel (zéro si l’appel a échoué avant facturation). */
export async function settleBudget(wid: string, actorId: string, period: string, reserved: number, spent: number): Promise<void> {
  await commandAs(actorId, (tx: Tx) => tx.query(
    `update public.ai_budget set reserved_micros = greatest(0, reserved_micros - $3), spent_micros = spent_micros + $4 where workspace_id = $1 and period_start = $2::date`,
    [wid, period, reserved, spent],
  ));
}

/** Réserve, appelle, puis compte le coût réel, que l’appel réussisse ou non. `reserve` à 0 : rien n’est compté (simulation). */
export async function withBudget<T>(wid: string, actorId: string, reserve: number, manual: string, call: () => Promise<T>, spentOf: (r: T) => number): Promise<T> {
  const period = budgetPeriod(new Date());
  if (reserve) await reserveBudget(wid, actorId, period, reserve, manual);
  let result: T;
  try {
    result = await call();
  } catch (e) {
    if (reserve) await settleBudget(wid, actorId, period, reserve, (e as { usage?: { costMicros?: number } }).usage?.costMicros ?? 0);
    throw e;
  }
  if (reserve) await settleBudget(wid, actorId, period, reserve, spentOf(result));
  return result;
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
