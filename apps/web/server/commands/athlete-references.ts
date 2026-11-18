import { athleteReferencesSchema, parseWith, type References } from '@coachos/domain';
import { commandAs, readAs, type Tx } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';

// Repères d’entraînement (CE-B-03, D-029) : le coach affecté les fixe, l’athlète les lit.

export interface AthleteReferences extends References {
  revision: number;
  updatedAt: string;
}

type Row = { vma_kmh: string | number | null; revision: number; updated_at: Date };
const toRefs = (r: Row): AthleteReferences => ({
  vmaKmh: r.vma_kmh === null ? null : Number(r.vma_kmh),
  revision: r.revision,
  updatedAt: new Date(r.updated_at).toISOString(),
});

async function requireAssignedCoach(tx: Tx, wid: string, aid: string) {
  const r = await tx.query<{ ok: boolean; state: string | null }>(
    `select private.assigned($1, $2) as ok,
            (select state from public.athletes where workspace_id = $1 and id = $2) as state`,
    [wid, aid],
  );
  const row = r.rows[0];
  if (!row?.ok || row.state === 'archived') throw notVisible();
}

/** saveAthleteReferences · C : le coach affecté fixe les repères de l’athlète. */
export async function saveAthleteReferences(
  meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; athleteId: string },
  body: unknown,
): Promise<StoredResponse> {
  const parsed = parseWith(athleteReferencesSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { workspaceId: wid, athleteId: aid } = meta;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, wid, aid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.references', key: meta.idempotencyKey, body }, async () => {
      const r = await tx.query<Row>(
        `insert into public.athlete_references(workspace_id, athlete_id, vma_kmh, updated_by)
         values ($1, $2, $3, auth.uid())
         on conflict (workspace_id, athlete_id) do update set
           vma_kmh = excluded.vma_kmh, updated_by = excluded.updated_by,
           revision = public.athlete_references.revision + 1, updated_at = now()
         returning vma_kmh, revision, updated_at`,
        [wid, aid, parsed.value.vmaKmh],
      );
      await audit(tx, wid, meta.actorId, 'athlete.references', aid, meta.requestId);
      return { status: 200, body: { item: toRefs(r.rows[0]!) } };
    });
  });
}

/** Lecture sous RLS : coach affecté ou athlète du dossier. Repères vides si absents ou non visibles. */
export async function readAthleteReferences(userId: string, wid: string, aid: string): Promise<References> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(`select vma_kmh, revision, updated_at from public.athlete_references where workspace_id = $1 and athlete_id = $2`, [wid, aid]);
    return r.rows[0] ? { vmaKmh: toRefs(r.rows[0]).vmaKmh } : { vmaKmh: null };
  });
}
