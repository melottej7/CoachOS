import {
  addDays, applyProposalSchema, PROPOSAL_INFO, parseWith, proposeWeek, todayIn, weekStart,
  type Block, type ProposalKind, type WorkoutInput, type References, type Sport, type WeekProposal, type WeekSession,
} from '@coachos/domain';
import { commandAs, readAs, type Tx } from '../db/client';
import { conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { insertRevision, requireAssignedCoach } from './workouts';
import { readAthleteReferences } from './athlete-references';

// CE-P-05 (D-056) : propositions d’adaptation d’une semaine. Calculées côté serveur depuis les séances en base,
// appliquées en nouvelles révisions (brouillons) ; la publication reste un geste séparé.

type Row = {
  id: string; working_revision: number; local_date: string; sort_order: number; time_zone: string; sport_code: Sport; title: string;
  instructions: string; duration_seconds: number | null; distance_m: number | null; intervals: Block[] | null; canceled: boolean; done: boolean;
};

async function weekRows(tx: Tx, wid: string, aid: string, monday: string): Promise<Row[]> {
  const r = await tx.query<Row>(
    `select w.id, w.working_revision, to_char(r.local_date, 'YYYY-MM-DD') as local_date, r.sort_order, r.time_zone, r.sport_code, r.title,
            r.instructions, r.duration_seconds, r.distance_m, r.intervals, r.canceled,
            exists (select 1 from public.workout_results res where res.workspace_id = w.workspace_id and res.athlete_id = w.athlete_id and res.workout_id = w.id) as done
     from public.workouts w
     join public.workout_revisions r on r.workspace_id = w.workspace_id and r.athlete_id = w.athlete_id and r.workout_id = w.id and r.number = w.working_revision
     where w.workspace_id = $1 and w.athlete_id = $2 and r.local_date between $3::date and $4::date
     order by r.local_date, r.sort_order, w.created_at`,
    [wid, aid, monday, addDays(monday, 6)],
  );
  return r.rows;
}

/** Séances de la semaine vues par la proposition : faites, passées ou annulées = bloquées. */
function toSessions(rows: Row[], today: string): WeekSession[] {
  return rows.map((x) => ({
    id: x.id, revision: x.working_revision, localDate: x.local_date, title: x.title, sport: x.sport_code,
    blocks: Array.isArray(x.intervals) ? x.intervals : [], durationSeconds: x.duration_seconds,
    locked: x.canceled || x.done || x.local_date < today,
  }));
}

/** Les quatre propositions pour la semaine d’un élève (coach affecté). null si non visible. */
export async function weekProposals(userId: string, wid: string, aid: string, monday: string): Promise<{ proposals: WeekProposal[]; sessions: WeekSession[] } | null> {
  const refs = await readAthleteReferences(userId, wid, aid);
  return readAs(userId, async (tx) => {
    const a = await tx.query<{ time_zone: string; ok: boolean }>('select time_zone, private.assigned(workspace_id, id) as ok from public.athletes where workspace_id = $1 and id = $2', [wid, aid]);
    if (!a.rows[0]?.ok) return null;
    const sessions = toSessions(await weekRows(tx, wid, aid, monday), todayIn(a.rows[0].time_zone));
    return { sessions, proposals: (['recovery', 'lighter', 'endurance', 'restart'] as ProposalKind[]).map((k) => proposeWeek(sessions, k, refs)) };
  });
}

/** applyWeekProposal · C : applique la proposition choisie en brouillons ; refus si une séance a changé depuis l’aperçu. */
export async function applyWeekProposal(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; athleteId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(applyProposalSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const v = parsed.value as { monday: string; kind: ProposalKind; seen: { id: string; revision: number }[] };
  if (weekStart(v.monday) !== v.monday) throw invalid([{ path: 'monday', rule: 'La semaine commence un lundi' }]);
  const wid = meta.workspaceId, aid = meta.athleteId;
  const refs: References = await readAthleteReferences(meta.actorId, wid, aid);
  return commandAs(meta.actorId, async (tx) => {
    await requireAssignedCoach(tx, wid, aid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'week.proposal', key: meta.idempotencyKey, body: { aid, ...v } }, async () => {
      const a = await tx.query<{ time_zone: string }>('select time_zone from public.athletes where workspace_id = $1 and id = $2', [wid, aid]);
      if (!a.rows[0]) throw notVisible();
      const rows = await weekRows(tx, wid, aid, v.monday);
      await tx.query('select 1 from public.workouts where workspace_id = $1 and id = any($2::uuid[]) for update', [wid, rows.map((r) => r.id)]);
      const seen = new Map(v.seen.map((x) => [x.id, x.revision]));
      // La semaine doit être celle de l’aperçu : mêmes séances, mêmes révisions.
      if (rows.length !== v.seen.length || rows.some((r) => seen.get(r.id) !== r.working_revision)) {
        throw conflict('La semaine a changé depuis l’aperçu. Recharge la page pour revoir les propositions.', {});
      }
      const proposal = proposeWeek(toSessions(rows, todayIn(a.rows[0].time_zone)), v.kind, refs);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const updated: { workoutId: string; revision: number; canceled: boolean }[] = [];
      for (const c of proposal.changes) {
        const r = byId.get(c.id)!;
        const n = r.working_revision + 1;
        const base = { localDate: r.local_date, timeZone: r.time_zone, sortOrder: r.sort_order, sport: r.sport_code, instructions: r.instructions || null };
        if (c.after) {
          await insertRevision(tx, wid, aid, r.id, n, { ...base, title: c.after.title, durationSeconds: c.after.durationSeconds, distanceM: null, intervals: c.after.blocks as WorkoutInput['intervals'] });
        } else {
          await insertRevision(tx, wid, aid, r.id, n, { ...base, title: r.title, durationSeconds: r.duration_seconds, distanceM: r.distance_m, intervals: (Array.isArray(r.intervals) ? r.intervals : []) as WorkoutInput['intervals'] }, `Retirée : ${PROPOSAL_INFO[v.kind].title.toLowerCase()}`);
        }
        await tx.query('update public.workouts set working_revision = $4 where workspace_id = $1 and athlete_id = $2 and id = $3', [wid, aid, r.id, n]);
        updated.push({ workoutId: r.id, revision: n, canceled: !c.after });
      }
      await audit(tx, wid, meta.actorId, 'week.proposal', aid, meta.requestId);
      return { status: 200, body: { kind: v.kind, updated } };
    });
  });
}
