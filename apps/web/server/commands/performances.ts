import { parseWith, performanceSchema, todayIn, type Performance, type PerformanceInput, type PerformanceKind, type Sport } from '@coachos/domain';
import { commandAs, readAs } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned } from './portfolio';

// D-060 : résultats de référence (courses, tests, séances de référence), saisis par le coach affecté, lus par l’élève.

type Meta = { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; athleteId: string };
type Row = { id: string; sport_code: Sport; kind: PerformanceKind; name: string | null; distance_m: number; duration_s: number; done_on: string };
const cols = `id, sport_code, kind, name, distance_m, duration_s, to_char(done_on, 'YYYY-MM-DD') as done_on`;
const toPerf = (r: Row): Performance => ({ id: r.id, sport: r.sport_code, kind: r.kind, name: r.name, distanceM: r.distance_m, durationS: r.duration_s, doneOn: r.done_on });

/** addPerformance · C : un résultat passé (jamais dans le futur, dans le fuseau de l’élève). */
export async function addPerformance(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(performanceSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const v = parsed.value as PerformanceInput;
  const { workspaceId: wid, athleteId: aid } = meta;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, aid);
    const a = await tx.query<{ time_zone: string }>('select time_zone from public.athletes where workspace_id = $1 and id = $2', [wid, aid]);
    if (v.doneOn > todayIn(a.rows[0]!.time_zone)) throw invalid([{ path: 'doneOn', rule: 'Un résultat est une date passée' }]);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'performance.add', key: meta.idempotencyKey, body: { aid, ...v } }, async () => {
      const r = await tx.query<Row>(
        `insert into public.athlete_performances(workspace_id, athlete_id, sport_code, kind, name, distance_m, duration_s, done_on, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8::date, auth.uid()) returning ${cols}`,
        [wid, aid, v.sport, v.kind, v.name, v.distanceM, v.durationS, v.doneOn],
      );
      await audit(tx, wid, meta.actorId, 'performance.add', r.rows[0]!.id, meta.requestId);
      return { status: 201, body: { item: toPerf(r.rows[0]!) } };
    });
  });
}

/** deletePerformance · C : retirer un résultat saisi par erreur. */
export async function deletePerformance(meta: Meta & { performanceId: string }): Promise<StoredResponse> {
  const { workspaceId: wid, athleteId: aid } = meta;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, aid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'performance.delete', key: meta.idempotencyKey, body: { aid, id: meta.performanceId } }, async () => {
      const r = await tx.query('delete from public.athlete_performances where workspace_id = $1 and athlete_id = $2 and id = $3 returning id', [wid, aid, meta.performanceId]);
      if (!r.rows.length) throw notVisible();
      await audit(tx, wid, meta.actorId, 'performance.delete', meta.performanceId, meta.requestId);
      return { status: 200, body: { deleted: meta.performanceId } };
    });
  });
}

/** Résultats d’un élève, du plus récent au plus ancien (coach affecté ou élève lui-même). */
export async function readPerformances(userId: string, wid: string, aid: string): Promise<Performance[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<Row>(`select ${cols} from public.athlete_performances where workspace_id = $1 and athlete_id = $2 order by done_on desc, created_at desc`, [wid, aid]);
    return r.rows.map(toPerf);
  });
}
