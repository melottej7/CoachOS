import { createHash } from 'node:crypto';
import type { Tx } from '../db/client';
import { AppError } from '../errors';

export interface StoredResponse {
  status: number;
  body: unknown;
}

interface Scope {
  /** Absent : opération d’identité (créer un espace, accepter une invitation) → identity_operation_keys. */
  workspaceId?: string;
  actorId: string;
  action: string;
  key: string;
  body: unknown;
}

/**
 * Idempotency-Key (docs/06_API.md) : même clé + même contenu → même réponse pendant 24 h,
 * même clé + contenu différent → 409. La ligne est insérée avant l’effet, dans la même
 * transaction : une requête concurrente attend le commit puis relit la réponse.
 * Si l’effet échoue, la transaction annule aussi la clé et la reprise reste possible.
 */
export async function idempotent(tx: Tx, scope: Scope, effect: () => Promise<StoredResponse>): Promise<StoredResponse> {
  const hash = createHash('sha256').update(JSON.stringify(scope.body ?? null)).digest('hex');
  const ws = scope.workspaceId !== undefined;
  const table = ws ? 'public.operation_keys' : 'public.identity_operation_keys';
  const where = ws
    ? 'workspace_id = $1 and actor_id = $2 and action = $3 and request_key = $4'
    : 'actor_id = $1 and action = $2 and request_key = $3';
  const keyParams = ws
    ? [scope.workspaceId, scope.actorId, scope.action, scope.key]
    : [scope.actorId, scope.action, scope.key];
  const next = `$${keyParams.length + 1}`;

  await tx.query(`delete from ${table} where ${where} and expires_at <= now()`, keyParams);
  const columns = ws ? 'workspace_id, actor_id, action, request_key' : 'actor_id, action, request_key';
  const placeholders = keyParams.map((_, i) => `$${i + 1}`).join(', ');
  const inserted = await tx.query(
    `insert into ${table}(${columns}, request_hash, expires_at)
     values (${placeholders}, ${next}, now() + interval '24 hours') on conflict do nothing`,
    [...keyParams, hash],
  );
  if ((inserted.affectedRows ?? 0) === 0) {
    const existing = await tx.query<{ request_hash: string; response: StoredResponse | null }>(
      `select request_hash, response from ${table} where ${where}`,
      keyParams,
    );
    const row = existing.rows[0];
    if (!row || row.request_hash !== hash || !row.response) {
      throw new AppError('CONFLICT_OR_QUOTA', 'Cette clé de requête a déjà servi pour une autre demande.');
    }
    return row.response;
  }
  const response = await effect();
  await tx.query(`update ${table} set response = ${next} where ${where}`, [...keyParams, JSON.stringify(response)]);
  return response;
}

export async function audit(tx: Tx, workspaceId: string, actorId: string, action: string, targetId: string, requestId: string) {
  // Journal sans texte libre ni contenu athlète.
  await tx.query(
    'insert into public.audit_logs(workspace_id, actor_id, action, target_id, request_id) values ($1, $2, $3, $4, $5)',
    [workspaceId, actorId, action, targetId, requestId],
  );
}
