import { createHash } from 'node:crypto';
import type { Tx } from '../db/client';
import { AppError } from '../errors';

export interface StoredResponse {
  status: number;
  body: unknown;
}

/**
 * Idempotency-Key (docs/06_API.md) : même clé + même contenu → même réponse pendant 24 h,
 * même clé + contenu différent → 409. La ligne est insérée avant l’effet, dans la même
 * transaction : une requête concurrente attend le commit puis relit la réponse.
 * Si l’effet échoue, la transaction annule aussi la clé et la reprise reste possible.
 */
export async function idempotent(
  tx: Tx,
  scope: { workspaceId: string; actorId: string; action: string; key: string; body: unknown },
  effect: () => Promise<StoredResponse>,
): Promise<StoredResponse> {
  const hash = createHash('sha256').update(JSON.stringify(scope.body ?? null)).digest('hex');
  await tx.query(
    `delete from public.operation_keys
     where workspace_id = $1 and actor_id = $2 and action = $3 and request_key = $4 and expires_at <= now()`,
    [scope.workspaceId, scope.actorId, scope.action, scope.key],
  );
  const inserted = await tx.query(
    `insert into public.operation_keys(workspace_id, actor_id, action, request_key, request_hash, expires_at)
     values ($1, $2, $3, $4, $5, now() + interval '24 hours')
     on conflict do nothing`,
    [scope.workspaceId, scope.actorId, scope.action, scope.key, hash],
  );
  if ((inserted.affectedRows ?? 0) === 0) {
    const existing = await tx.query<{ request_hash: string; response: StoredResponse | null }>(
      `select request_hash, response from public.operation_keys
       where workspace_id = $1 and actor_id = $2 and action = $3 and request_key = $4`,
      [scope.workspaceId, scope.actorId, scope.action, scope.key],
    );
    const row = existing.rows[0];
    if (!row || row.request_hash !== hash || !row.response) {
      throw new AppError('CONFLICT_OR_QUOTA', 'Cette clé de requête a déjà servi pour une autre demande.');
    }
    return row.response;
  }
  const response = await effect();
  await tx.query(
    `update public.operation_keys set response = $5
     where workspace_id = $1 and actor_id = $2 and action = $3 and request_key = $4`,
    [scope.workspaceId, scope.actorId, scope.action, scope.key, JSON.stringify(response)],
  );
  return response;
}

export async function audit(tx: Tx, workspaceId: string, actorId: string, action: string, targetId: string, requestId: string) {
  // Journal sans texte libre ni contenu athlète.
  await tx.query(
    'insert into public.audit_logs(workspace_id, actor_id, action, target_id, request_id) values ($1, $2, $3, $4, $5)',
    [workspaceId, actorId, action, targetId, requestId],
  );
}
