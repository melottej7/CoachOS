import { createGroupSessionSchema, parseWith, publishGroupSessionSchema } from '@coachos/domain';
import { commandAs } from '../db/client';
import { AppError, conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { insertRevision, publishInTx, requireAssignedCoach } from './workouts';

// Lot G2 (D-042) : séance préparée pour un groupe. Droits identiques à la création séance par séance :
// coach actif, affecté à chaque élève, élève membre du groupe et dossier non archivé.

interface Meta { actorId: string; workspaceId: string; idempotencyKey: string; requestId: string }
const scope = (meta: Meta, action: string) => ({ workspaceId: meta.workspaceId, actorId: meta.actorId, action, key: meta.idempotencyKey });

/** Une base commune → un brouillon indépendant par élève choisi, à l’heure locale de chacun. Rien n’est publié. */
export async function createGroupSession(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(createGroupSessionSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { teamId, localDate, workout, athleteIds } = parsed.value;
  if (new Set(athleteIds).size !== athleteIds.length) throw invalid([{ path: 'athleteIds', rule: 'Un élève apparaît deux fois' }]);
  return commandAs(meta.actorId, async (tx) => {
    const team = await tx.query<{ ok: boolean; archived: boolean | null }>(
      `select private.current_coach($1) as ok, (select archived_at is not null from public.teams where workspace_id = $1 and id = $2) as archived`,
      [meta.workspaceId, teamId],
    );
    if (!team.rows[0]?.ok || team.rows[0].archived === null) throw notVisible();
    if (team.rows[0].archived) throw invalid([{ path: 'teamId', rule: 'Ce groupe est archivé' }]);
    return idempotent(tx, { ...scope(meta, 'group_session.create'), body }, async () => {
      const members = await tx.query<{ id: string; display_name: string; time_zone: string; state: string; member: boolean; assigned: boolean }>(
        `select a.id, a.display_name, a.time_zone, a.state,
                exists (select 1 from public.team_athletes ta where ta.workspace_id = a.workspace_id and ta.team_id = $2 and ta.athlete_id = a.id) as member,
                private.assigned(a.workspace_id, a.id) as assigned
         from public.athletes a where a.workspace_id = $1 and a.id = any($3::uuid[])`,
        [meta.workspaceId, teamId, athleteIds],
      );
      const byId = new Map(members.rows.map((m) => [m.id, m]));
      for (const [i, aid] of athleteIds.entries()) {
        const m = byId.get(aid);
        if (!m || !m.assigned || m.state === 'archived') throw invalid([{ path: `athleteIds.${i}`, rule: 'Élève introuvable ou non suivi par toi' }]);
        if (!m.member) throw invalid([{ path: `athleteIds.${i}`, rule: `${m.display_name} n’est pas dans ce groupe` }]);
      }
      const gs = await tx.query<{ id: string }>(
        `insert into public.group_sessions(workspace_id, team_id, created_by, local_date, title, base)
         values ($1, $2, $3, $4::date, $5, $6::jsonb) returning id`,
        [meta.workspaceId, teamId, meta.actorId, localDate, workout.title, JSON.stringify(workout)],
      );
      const gid = gs.rows[0]!.id;
      const items: { athleteId: string; workoutId: string }[] = [];
      for (const aid of athleteIds) {
        const m = byId.get(aid)!;
        await requireAssignedCoach(tx, meta.workspaceId, aid);
        const w = await tx.query<{ id: string }>(
          `insert into public.workouts(workspace_id, athlete_id, working_revision, group_session_id) values ($1, $2, 1, $3) returning id`,
          [meta.workspaceId, aid, gid],
        );
        const sid = w.rows[0]!.id;
        await insertRevision(tx, meta.workspaceId, aid, sid, 1, { ...workout, localDate, timeZone: m.time_zone, sortOrder: 0 });
        items.push({ athleteId: aid, workoutId: sid });
      }
      await audit(tx, meta.workspaceId, meta.actorId, 'group_session.create', gid, meta.requestId);
      return { status: 201, body: { id: gid, items } };
    });
  });
}

/**
 * Publication explicite des lignes choisies (les autres sont les exceptions). Atomique : si une séance a changé
 * depuis l’aperçu, rien n’est publié (409 avec la ligne). Chaque ligne doit appartenir à cette séance de groupe.
 */
export async function publishGroupSession(meta: Meta & { groupSessionId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(publishGroupSessionSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { items } = parsed.value;
  if (new Set(items.map((x) => x.workoutId)).size !== items.length) throw invalid([{ path: 'items', rule: 'Une séance apparaît deux fois' }]);
  return commandAs(meta.actorId, async (tx) => {
    const gs = await tx.query<{ id: string }>('select id from public.group_sessions where workspace_id = $1 and id = $2 and private.current_coach($1)', [meta.workspaceId, meta.groupSessionId]);
    if (!gs.rows[0]) throw notVisible();
    return idempotent(tx, { ...scope(meta, 'group_session.publish'), body }, async () => {
      const own = await tx.query<{ id: string; athlete_id: string }>(
        'select id, athlete_id from public.workouts where workspace_id = $1 and group_session_id = $2',
        [meta.workspaceId, meta.groupSessionId],
      );
      const of = new Map(own.rows.map((r) => [r.id, r.athlete_id]));
      let published = 0;
      for (const [i, it] of items.entries()) {
        if (of.get(it.workoutId) !== it.athleteId) throw invalid([{ path: `items.${i}.workoutId`, rule: 'Séance étrangère à cette séance de groupe' }]);
        await requireAssignedCoach(tx, meta.workspaceId, it.athleteId);
        try {
          published += await publishInTx(tx, { workspaceId: meta.workspaceId, athleteId: it.athleteId, actorId: meta.actorId, requestId: meta.requestId }, [{ id: it.workoutId, revision: it.revision }], i);
        } catch (e) {
          // Message propre au groupe : l’élève dont la séance a changé.
          if (e instanceof AppError && e.code === 'CONFLICT_OR_QUOTA') {
            throw conflict('Une séance du groupe a changé depuis l’aperçu. Rien n’a été publié : recharge pour revoir les séances.', { line: i, workoutId: it.workoutId });
          }
          throw e;
        }
      }
      return { status: 200, body: { published, items: items.map((x) => ({ workoutId: x.workoutId, revision: x.revision })) } };
    });
  });
}
