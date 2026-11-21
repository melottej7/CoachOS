import { RELANCE_KINDS, type RelanceKind } from '@coachos/domain';
import { z } from 'zod';
import { commandAs, readAs } from '../db/client';
import { invalid } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireCoach } from './portfolio';

// D-104 · Modèles de relance du coach : un par situation, vide = celui de CoachOS.

interface Meta { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }

const schema = z.object({
  kind: z.enum(RELANCE_KINDS),
  /** null = revenir au modèle de CoachOS. */
  body: z.string().trim().max(1000, { message: '1000 caractères au plus' }).nullable().transform((v) => (v ? v : null)),
}).strict();

export async function saveRelanceTemplate(meta: Meta, body: unknown): Promise<StoredResponse> {
  const p = schema.safeParse(body);
  if (!p.success) throw invalid(p.error.issues.map((i) => ({ path: i.path.join('.') || 'body', rule: i.message })));
  const v = p.data;
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'relance.template', key: meta.idempotencyKey, body: v }, async () => {
      if (v.body === null) {
        await tx.query('delete from public.relance_templates where workspace_id = $1 and coach_id = auth.uid() and kind = $2', [wid, v.kind]);
      } else {
        await tx.query(
          `insert into public.relance_templates(workspace_id, coach_id, kind, body) values ($1, auth.uid(), $2, $3)
           on conflict (workspace_id, coach_id, kind) do update set body = excluded.body, updated_at = now()`,
          [wid, v.kind, v.body],
        );
      }
      await audit(tx, wid, meta.actorId, 'relance.template', wid, meta.requestId);
      return { status: 200, body: { kind: v.kind, body: v.body } };
    });
  });
}

/** Modèles enregistrés par le coach connecté (les autres situations gardent celui de CoachOS). */
export async function readRelanceTemplates(userId: string, wid: string): Promise<Partial<Record<RelanceKind, string>>> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ kind: RelanceKind; body: string }>('select kind, body from public.relance_templates where workspace_id = $1 and coach_id = auth.uid()', [wid]);
    return Object.fromEntries(r.rows.map((x) => [x.kind, x.body]));
  });
}
