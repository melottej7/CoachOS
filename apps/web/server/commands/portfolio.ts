import {
  confirmLevelSchema, createGoalSchema, createNoteSchema, createTeamSchema, parseWith, updateGoalSchema, updateTeamSchema,
  type GoalState, type Level, type Sport,
} from '@coachos/domain';
import { commandAs, type Tx } from '../db/client';
import { AppError, conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireOwner } from './invitations';

// Lot G (D-032) : groupes, appartenances, niveau par sport confirmé, objectifs, notes privées.

interface Meta { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }

/** Coach actif affecté au dossier, dossier non archivé. Sinon 404 uniforme. */
export async function requireAssigned(tx: Tx, wid: string, aid: string) {
  const r = await tx.query<{ ok: boolean; state: string | null }>(
    `select private.assigned($1, $2) as ok, (select state from public.athletes where workspace_id = $1 and id = $2) as state`,
    [wid, aid],
  );
  if (!r.rows[0]?.ok || r.rows[0].state === 'archived') throw notVisible();
}

export async function requireCoach(tx: Tx, wid: string) {
  const r = await tx.query<{ ok: boolean }>('select private.current_coach($1) as ok', [wid]);
  if (!r.rows[0]?.ok) throw notVisible();
}

const parse = <T>(schema: Parameters<typeof parseWith>[0], body: unknown): T => {
  const p = parseWith(schema, body);
  if (!p.ok) throw invalid(p.fields);
  return p.value as T;
};

// ---------- Groupes ----------

export interface TeamItem { id: string; name: string; sortOrder: number; archived: boolean }

async function nameTaken(tx: Tx, wid: string, name: string, except: string | null) {
  const r = await tx.query(`select 1 from public.teams where workspace_id = $1 and lower(name) = lower($2) and ($3::uuid is null or id <> $3::uuid)`, [wid, name, except]);
  if (r.rows.length) throw conflict('Un groupe porte déjà ce nom dans ton espace.');
}

/** createTeam · O : nouveau groupe, placé en fin de liste. */
export async function createTeam(meta: Meta, body: unknown): Promise<StoredResponse> {
  const { name } = parse<{ name: string }>(createTeamSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'team.create', key: meta.idempotencyKey, body }, async () => {
      await nameTaken(tx, wid, name, null);
      const r = await tx.query<{ id: string }>(
        `insert into public.teams(workspace_id, name, sort_order)
         values ($1, $2, coalesce((select max(sort_order) + 1 from public.teams where workspace_id = $1), 0)) returning id`,
        [wid, name],
      );
      await audit(tx, wid, meta.actorId, 'team.create', r.rows[0]!.id, meta.requestId);
      return { status: 201, body: { id: r.rows[0]!.id } };
    });
  });
}

/** updateTeam · O : renommer, réordonner, archiver ou désarchiver. Les séances publiées ne bougent pas. */
export async function updateTeam(meta: Meta & { teamId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ name?: string; sortOrder?: number; archived?: boolean }>(updateTeamSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'team.update', key: meta.idempotencyKey, body: { id: meta.teamId, ...v } }, async () => {
      const cur = await tx.query<{ id: string }>('select id from public.teams where workspace_id = $1 and id = $2 for update', [wid, meta.teamId]);
      if (!cur.rows[0]) throw notVisible();
      if (v.name !== undefined) await nameTaken(tx, wid, v.name, meta.teamId);
      // Placer à un rang décale les groupes suivants : l’ordre reste total.
      if (v.sortOrder !== undefined) {
        await tx.query('update public.teams set sort_order = sort_order + 1 where workspace_id = $1 and id <> $2 and sort_order >= $3', [wid, meta.teamId, v.sortOrder]);
      }
      const r = await tx.query<{ id: string; name: string; sort_order: number; archived_at: Date | null }>(
        `update public.teams set
           name = coalesce($3, name),
           sort_order = coalesce($4, sort_order),
           archived_at = case when $5::boolean is null then archived_at when $5 then coalesce(archived_at, now()) else null end
         where workspace_id = $1 and id = $2 returning id, name, sort_order, archived_at`,
        [wid, meta.teamId, v.name ?? null, v.sortOrder ?? null, v.archived ?? null],
      );
      await audit(tx, wid, meta.actorId, 'team.update', meta.teamId, meta.requestId);
      const t = r.rows[0]!;
      return { status: 200, body: { item: { id: t.id, name: t.name, sortOrder: t.sort_order, archived: t.archived_at !== null } satisfies TeamItem } };
    });
  });
}

/** setTeamMember · C : ajouter (member = true) ou retirer un élève affecté d’un groupe. Appartenances multiples permises. */
export async function setTeamMember(meta: Meta & { teamId: string; athleteId: string }, member: boolean): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  const body = { teamId: meta.teamId, athleteId: meta.athleteId, member };
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: member ? 'team.add' : 'team.remove', key: meta.idempotencyKey, body }, async () => {
      const t = await tx.query<{ archived_at: Date | null }>('select archived_at from public.teams where workspace_id = $1 and id = $2', [wid, meta.teamId]);
      if (!t.rows[0]) throw notVisible();
      if (member) {
        if (t.rows[0].archived_at) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Ce groupe est archivé.');
        await tx.query(
          `insert into public.team_athletes(workspace_id, team_id, athlete_id) values ($1, $2, $3) on conflict do nothing`,
          [wid, meta.teamId, meta.athleteId],
        );
      } else {
        await tx.query('delete from public.team_athletes where workspace_id = $1 and team_id = $2 and athlete_id = $3', [wid, meta.teamId, meta.athleteId]);
      }
      await audit(tx, wid, meta.actorId, member ? 'team.add' : 'team.remove', meta.athleteId, meta.requestId);
      return { status: 200, body };
    });
  });
}

// ---------- Niveau par sport ----------

/** confirmLevel · C : le coach confirme ou corrige le niveau d’un sport ; auteur et date enregistrés. */
export async function confirmLevel(meta: Meta & { athleteId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ sport: Sport; level: Level }>(confirmLevelSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.level', key: meta.idempotencyKey, body: { athleteId: meta.athleteId, ...v } }, async () => {
      const r = await tx.query<{ confirmed_at: Date }>(
        `insert into public.athlete_sport_levels(workspace_id, athlete_id, sport_code, level, confirmed_by)
         values ($1, $2, $3, $4, auth.uid())
         on conflict (workspace_id, athlete_id, sport_code) do update set level = excluded.level, confirmed_by = excluded.confirmed_by, confirmed_at = now()
         returning confirmed_at`,
        [wid, meta.athleteId, v.sport, v.level],
      );
      await audit(tx, wid, meta.actorId, 'athlete.level', meta.athleteId, meta.requestId);
      return { status: 200, body: { item: { sport: v.sport, level: v.level, confirmedAt: new Date(r.rows[0]!.confirmed_at).toISOString() } } };
    });
  });
}

// ---------- Objectifs ----------

type GoalRow = { id: string; title: string; sport_code: Sport; target_date: string | null; state: GoalState };
const goalCols = `id, title, sport_code, to_char(target_date, 'YYYY-MM-DD') as target_date, state`;
const toGoal = (g: GoalRow) => ({ id: g.id, title: g.title, sport: g.sport_code, targetDate: g.target_date, state: g.state });

/** createGoal · C : objectif visible par l’élève. */
export async function createGoal(meta: Meta & { athleteId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ title: string; sport: Sport; targetDate: string | null }>(createGoalSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'goal.create', key: meta.idempotencyKey, body: { athleteId: meta.athleteId, ...v } }, async () => {
      const r = await tx.query<GoalRow>(
        `insert into public.goals(workspace_id, athlete_id, sport_code, title, target_date, state)
         values ($1, $2, $3, $4, $5::date, 'planned') returning ${goalCols}`,
        [wid, meta.athleteId, v.sport, v.title, v.targetDate],
      );
      await audit(tx, wid, meta.actorId, 'goal.create', r.rows[0]!.id, meta.requestId);
      return { status: 201, body: { item: toGoal(r.rows[0]!) } };
    });
  });
}

/** updateGoal · C : atteint, abandonné, ou nouvelle échéance. */
export async function updateGoal(meta: Meta & { athleteId: string; goalId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ state: GoalState; targetDate?: string | null }>(updateGoalSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'goal.update', key: meta.idempotencyKey, body: { id: meta.goalId, ...v } }, async () => {
      const r = await tx.query<GoalRow>(
        `update public.goals set state = $4, target_date = case when $5::boolean then $6::date else target_date end
         where workspace_id = $1 and athlete_id = $2 and id = $3 returning ${goalCols}`,
        [wid, meta.athleteId, meta.goalId, v.state, v.targetDate !== undefined, v.targetDate ?? null],
      );
      if (!r.rows[0]) throw notVisible();
      await audit(tx, wid, meta.actorId, 'goal.update', meta.goalId, meta.requestId);
      return { status: 200, body: { item: toGoal(r.rows[0]) } };
    });
  });
}

// ---------- Notes privées ----------

/** createCoachNote · C : note visible par son seul auteur affecté (RLS), jamais par l’élève ni l’assistant. */
export async function createNote(meta: Meta & { athleteId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ body: string }>(createNoteSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'note.create', key: meta.idempotencyKey, body: { athleteId: meta.athleteId, ...v } }, async () => {
      const r = await tx.query<{ id: string; created_at: Date }>(
        `insert into public.coach_notes(workspace_id, athlete_id, author_id, body) values ($1, $2, auth.uid(), $3) returning id, created_at`,
        [wid, meta.athleteId, v.body],
      );
      await audit(tx, wid, meta.actorId, 'note.create', r.rows[0]!.id, meta.requestId);
      return { status: 201, body: { item: { id: r.rows[0]!.id, createdAt: new Date(r.rows[0]!.created_at).toISOString(), body: v.body } } };
    });
  });
}

/** deleteCoachNote · C : l’auteur efface sa note. */
export async function deleteNote(meta: Meta & { athleteId: string; noteId: string }): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, meta.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'note.delete', key: meta.idempotencyKey, body: { id: meta.noteId } }, async () => {
      const r = await tx.query(
        'delete from public.coach_notes where workspace_id = $1 and athlete_id = $2 and id = $3 and author_id = auth.uid() returning id',
        [wid, meta.athleteId, meta.noteId],
      );
      if (!r.rows.length) throw notVisible();
      await audit(tx, wid, meta.actorId, 'note.delete', meta.noteId, meta.requestId);
      return { status: 200, body: { id: meta.noteId } };
    });
  });
}
