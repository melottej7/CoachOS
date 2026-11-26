import { parseWith } from '@coachos/domain';
import { z } from 'zod';
import { commandAs, type Tx } from '../db/client';
import { AppError, invalid } from '../errors';
import { audit, idempotent, type StoredResponse } from '../commands/idempotency';
import { requireOwner } from '../commands/invitations';
import { requireCoach } from '../commands/portfolio';

/**
 * IA-0 · Interrupteur par espace. Le propriétaire peut éteindre l’IA (Claude ou simulée) pour tout l’espace ; l’app
 * reste complète à la main. Rangé dans `workspace_flags` (drapeau « ai_off »), sans migration : pas de ligne = IA allumée.
 */

const FLAG = 'ai_off';

/** IA allumée pour cet espace (lecture dans la transaction donnée). */
export async function aiOnIn(tx: Tx, wid: string): Promise<boolean> {
  const r = await tx.query<{ enabled: boolean }>('select enabled from public.workspace_flags where workspace_id = $1 and flag = $2', [wid, FLAG]);
  return !r.rows[0]?.enabled;
}

/** IA allumée pour cet espace, vu par un coach de l’espace (refus sinon). */
export async function aiEnabled(actorId: string, wid: string): Promise<boolean> {
  return commandAs(actorId, async (tx) => { await requireCoach(tx, wid); return aiOnIn(tx, wid); });
}

/** Refus explicite quand l’IA est éteinte : la voie manuelle est rappelée. */
export const aiOff = (manual: string) => new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', `L’IA est éteinte pour cet espace (Paramètres › IA). ${manual}.`);

const bodySchema = z.object({ enabled: z.boolean() }).strict();

/** setWorkspaceAi · O : allumer ou éteindre l’IA pour tout l’espace. */
export async function setWorkspaceAi(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const p = parseWith(bodySchema, body);
  if (!p.ok) throw invalid(p.fields);
  const { enabled } = p.value as { enabled: boolean };
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'ai.settings', key: meta.idempotencyKey, body: { enabled } }, async () => {
      await tx.query(
        `insert into public.workspace_flags(workspace_id, flag, enabled) values ($1, $2, $3)
         on conflict (workspace_id, flag) do update set enabled = excluded.enabled`,
        [wid, FLAG, !enabled],
      );
      await audit(tx, wid, meta.actorId, 'ai.settings', wid, meta.requestId);
      return { status: 200, body: { enabled } };
    });
  });
}
