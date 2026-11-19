import { goalDecisionSchema, parseWith, type FeasibilityStatus, type GoalDecisionInput } from '@coachos/domain';
import { commandAs, readAs } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned } from './portfolio';

// D-058 : le coach décide. La faisabilité calculée est une indication ; la décision (paramètres et justification) est
// enregistrée pour le coach seul et sert de contrainte au futur générateur de programme (lot P).

export interface GoalDecision {
  goalId: string;
  statusAtDecision: FeasibilityStatus;
  params: GoalDecisionInput['params'];
  note: string | null;
  decidedAt: string;
  revision: number;
}

/** decideGoal · C : valider un objectif (tel quel ou ajusté), avec la date reportée sur l’objectif si demandé. */
export async function decideGoal(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; athleteId: string; goalId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(goalDecisionSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const v = parsed.value as GoalDecisionInput;
  const { workspaceId: wid, athleteId: aid, goalId } = meta;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, aid);
    const g = await tx.query<{ state: string }>('select state from public.goals where workspace_id = $1 and athlete_id = $2 and id = $3 for update', [wid, aid, goalId]);
    if (!g.rows[0]) throw notVisible();
    if (g.rows[0].state !== 'planned') throw invalid([{ path: 'goalId', rule: 'Seul un objectif prévu peut être validé' }]);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'goal.decide', key: meta.idempotencyKey, body: { goalId, ...v } }, async () => {
      const r = await tx.query<{ decided_at: Date; revision: number }>(
        `insert into public.goal_decisions(workspace_id, goal_id, athlete_id, decided_by, status_at_decision, params, note)
         values ($1, $2, $3, auth.uid(), $4, $5::jsonb, $6)
         on conflict (workspace_id, goal_id) do update set decided_by = excluded.decided_by, decided_at = now(),
           status_at_decision = excluded.status_at_decision, params = excluded.params, note = excluded.note,
           revision = public.goal_decisions.revision + 1
         returning decided_at, revision`,
        [wid, goalId, aid, v.statusAtDecision, JSON.stringify(v.params), v.note],
      );
      if (v.applyDate) {
        await tx.query('update public.goals set target_date = $4::date where workspace_id = $1 and athlete_id = $2 and id = $3', [wid, aid, goalId, v.params.eventDate]);
      }
      await audit(tx, wid, meta.actorId, 'goal.decide', goalId, meta.requestId);
      const x = r.rows[0]!;
      return { status: 200, body: { item: { goalId, statusAtDecision: v.statusAtDecision, params: v.params, note: v.note, decidedAt: new Date(x.decided_at).toISOString(), revision: x.revision } } };
    });
  });
}

/** Décisions des objectifs d’un élève, pour les coachs affectés seulement (RLS). */
export async function readGoalDecisions(userId: string, wid: string, aid: string): Promise<GoalDecision[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ goal_id: string; status_at_decision: FeasibilityStatus; params: GoalDecisionInput['params']; note: string | null; decided_at: Date; revision: number }>(
      'select goal_id, status_at_decision, params, note, decided_at, revision from public.goal_decisions where workspace_id = $1 and athlete_id = $2',
      [wid, aid],
    );
    return r.rows.map((x) => ({ goalId: x.goal_id, statusAtDecision: x.status_at_decision, params: x.params, note: x.note, decidedAt: new Date(x.decided_at).toISOString(), revision: x.revision }));
  });
}
