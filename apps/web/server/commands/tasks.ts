import {
  appointmentAnnouncement, canTransition, createAppointmentSchema, formatLongDate, utcToLocal, createTaskSchema, isTimeZone, localToUtc, parseWith, snoozeSchema, updateAppointmentSchema,
  updateTaskSchema, TASK_STATUS_LABELS, nextOccurrence, type TaskRecurrence, resolveRuleSettings, ruleSettingsSchema,
  type AppointmentKind, type AppointmentStatus, type AutoRule, type CreateTaskInput, type TaskKind, type TaskStatus,
} from '@coachos/domain';
import { commandAs } from '../db/client';
import { AppError, conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireAssigned, requireCoach } from './portfolio';
import { announceAppointment } from './messages';

// Lot H (D-032) : tâches humaines, report des suivis automatiques, rendez-vous.

interface Meta { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }

const parse = <T>(schema: Parameters<typeof parseWith>[0], body: unknown): T => {
  const p = parseWith(schema, body);
  if (!p.ok) throw invalid(p.fields);
  return p.value as T;
};

// ---------- Tâches ----------

export interface TaskItem {
  id: string; title: string; kind: TaskKind; athleteId: string | null; teamId: string | null; dueOn: string | null;
  priority: number; status: TaskStatus; link: string | null; notes: string | null; revision: number; recurrence: TaskRecurrence | null;
}
type TaskRow = {
  id: string; title: string; kind: TaskKind; athlete_id: string | null; team_id: string | null; due_on: string | null;
  priority: number; status: TaskStatus; link: string | null; notes: string | null; revision: number; recurrence: TaskRecurrence | null;
};
const taskCols = `id, title, kind, athlete_id, team_id, to_char(due_on, 'YYYY-MM-DD') as due_on, priority, status, link, notes, revision, recurrence`;
const toTask = (t: TaskRow): TaskItem => ({
  id: t.id, title: t.title, kind: t.kind, athleteId: t.athlete_id, teamId: t.team_id, dueOn: t.due_on,
  priority: Number(t.priority), status: t.status, link: t.link, notes: t.notes, revision: t.revision, recurrence: t.recurrence,
});

/** createTask · C : tâche libre, ou liée à un élève affecté ou à un groupe ; responsable = l’auteur. */
export async function createTask(meta: Meta, body: unknown): Promise<StoredResponse> {
  const v = parse<CreateTaskInput>(createTaskSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    if (v.athleteId) await requireAssigned(tx, wid, v.athleteId);
    if (v.teamId) {
      const t = await tx.query('select 1 from public.teams where workspace_id = $1 and id = $2 and archived_at is null', [wid, v.teamId]);
      if (!t.rows.length) throw notVisible();
    }
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'task.create', key: meta.idempotencyKey, body }, async () => {
      const r = await tx.query<TaskRow>(
        `insert into public.coach_tasks(workspace_id, athlete_id, team_id, assignee_id, created_by, title, kind, due_on, priority, link, notes, recurrence)
         values ($1, $2, $3, auth.uid(), auth.uid(), $4, $5, $6::date, $7, $8, $9, $10) returning ${taskCols}`,
        [wid, v.athleteId, v.teamId, v.title, v.kind, v.dueOn, v.priority, v.link, v.notes, v.recurrence],
      );
      await audit(tx, wid, meta.actorId, 'task.create', r.rows[0]!.id, meta.requestId);
      return { status: 201, body: { item: toTask(r.rows[0]!) } };
    });
  });
}

/** updateTask · C : changer l’état (transitions vérifiées), l’échéance, la priorité ; révision attendue. */
export async function updateTask(meta: Meta & { taskId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ expectedRevision: number; status?: TaskStatus; dueOn?: string | null; priority?: number; title?: string; notes?: string | null }>(updateTaskSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'task.update', key: meta.idempotencyKey, body: { id: meta.taskId, ...v } }, async () => {
      const cur = await tx.query<TaskRow>(
        `select ${taskCols} from public.coach_tasks
         where workspace_id = $1 and id = $2 and (assignee_id = auth.uid() or created_by = auth.uid())
           and (athlete_id is null or private.assigned(workspace_id, athlete_id)) for update`,
        [wid, meta.taskId],
      );
      const t = cur.rows[0];
      if (!t) throw notVisible();
      if (t.revision !== v.expectedRevision) throw conflict('Cette tâche a été modifiée ailleurs. Recharge la page.', { revision: t.revision });
      if (t.recurrence && v.dueOn === null) throw invalid([{ path: 'dueOn', rule: 'Une tâche récurrente a besoin d’une échéance' }]);
      if (v.status && !canTransition(t.status, v.status)) {
        throw new AppError('INVALID_FIELDS', 'Certains champs sont à corriger.', [{ path: 'status', rule: `Passage de « ${TASK_STATUS_LABELS[t.status]} » à « ${TASK_STATUS_LABELS[v.status]} » impossible` }]);
      }
      const closing = v.status === 'done' || v.status === 'canceled';
      const r = await tx.query<TaskRow>(
        `update public.coach_tasks set
           status = coalesce($3, status),
           due_on = case when $4::boolean then $5::date else due_on end,
           priority = coalesce($6, priority),
           title = coalesce($7, title),
           notes = case when $8::boolean then $9 else notes end,
           closed_at = case when $10::boolean then now() when $3 is not null then null else closed_at end,
           revision = revision + 1, updated_at = now()
         where workspace_id = $1 and id = $2 returning ${taskCols}`,
        [wid, meta.taskId, v.status ?? null, v.dueOn !== undefined, v.dueOn ?? null, v.priority ?? null, v.title ?? null, v.notes !== undefined, v.notes ?? null, closing],
      );
      await audit(tx, wid, meta.actorId, 'task.update', meta.taskId, meta.requestId);
      // CE-H-06 : une tâche récurrente faite crée l’occurrence suivante (une seule, même si l’on rejoue la clôture).
      let next: TaskItem | null = null;
      if (v.status === 'done' && t.status !== 'done' && t.recurrence && t.due_on) {
        const n = await tx.query<TaskRow>(
          `insert into public.coach_tasks(workspace_id, athlete_id, team_id, assignee_id, created_by, title, kind, due_on, priority, link, notes, recurrence)
           select workspace_id, athlete_id, team_id, assignee_id, auth.uid(), title, kind, $3::date, priority, link, notes, recurrence
           from public.coach_tasks where workspace_id = $1 and id = $2 returning ${taskCols}`,
          [wid, meta.taskId, nextOccurrence(t.due_on, t.recurrence)],
        );
        next = toTask(n.rows[0]!);
        await audit(tx, wid, meta.actorId, 'task.create', next.id, meta.requestId);
      }
      return { status: 200, body: { item: toTask(r.rows[0]!), next } };
    });
  });
}

/**
 * snoozeAutoTask · C : reporter (ou réactiver avec until = null) un suivi automatique.
 * Le suivi reste unique par règle et objet ; il se clôt seul quand l’objet est résolu.
 */
export async function snoozeAutoTask(meta: Meta & { sourceRef: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ rule: AutoRule; until: string | null }>(snoozeSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'autotask.snooze', key: meta.idempotencyKey, body: { ref: meta.sourceRef, ...v } }, async () => {
      await tx.query(
        `insert into public.auto_task_states(workspace_id, coach_id, rule, source_ref, snoozed_until)
         values ($1, auth.uid(), $2, $3, $4::date)
         on conflict (workspace_id, coach_id, rule, source_ref) do update set snoozed_until = excluded.snoozed_until, updated_at = now()`,
        [wid, v.rule, meta.sourceRef, v.until],
      );
      await audit(tx, wid, meta.actorId, 'autotask.snooze', meta.sourceRef, meta.requestId);
      return { status: 200, body: { rule: v.rule, sourceRef: meta.sourceRef, until: v.until } };
    });
  });
}

/**
 * saveAutoRuleSettings · C (CE-H-04, D-045) : le coach active ou désactive chaque suivi et règle son délai.
 * Réglage personnel (par coach et par espace) ; les suivis restent calculés depuis l’état réel.
 */
export async function saveAutoRuleSettings(meta: Meta, body: unknown): Promise<StoredResponse> {
  const v = parse<{ rules: { rule: AutoRule; enabled: boolean; delayDays: number | null }[] }>(ruleSettingsSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireCoach(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'autotask.settings', key: meta.idempotencyKey, body: v }, async () => {
      for (const r of v.rules) {
        await tx.query(
          `insert into public.auto_rule_settings(workspace_id, coach_id, rule, enabled, delay_days)
           values ($1, auth.uid(), $2, $3, $4)
           on conflict (workspace_id, coach_id, rule) do update set enabled = excluded.enabled, delay_days = excluded.delay_days, updated_at = now()`,
          [wid, r.rule, r.enabled, r.delayDays],
        );
      }
      await audit(tx, wid, meta.actorId, 'autotask.settings', wid, meta.requestId);
      const saved = await tx.query<{ rule: string; enabled: boolean; delay_days: number | null }>(
        'select rule, enabled, delay_days from public.auto_rule_settings where workspace_id = $1 and coach_id = auth.uid()', [wid],
      );
      return { status: 200, body: { rules: Object.values(resolveRuleSettings(saved.rows)) } };
    });
  });
}

// ---------- Rendez-vous ----------

export interface AppointmentItem {
  id: string; athleteId: string; title: string; kind: AppointmentKind; startsAt: string; durationMin: number; timeZone: string;
  videoUrl: string | null; prepNotes: string | null; report: string | null; status: AppointmentStatus; revision: number;
}
type ApptRow = {
  id: string; athlete_id: string; title: string; kind: AppointmentKind; starts_at: Date; duration_min: number; time_zone: string;
  video_url: string | null; prep_notes: string | null; report: string | null; status: AppointmentStatus; revision: number;
};
export const apptCols = 'id, athlete_id, title, kind, starts_at, duration_min, time_zone, video_url, prep_notes, report, status, revision';
export const toAppt = (a: ApptRow): AppointmentItem => ({
  id: a.id, athleteId: a.athlete_id, title: a.title, kind: a.kind, startsAt: new Date(a.starts_at).toISOString(), durationMin: Number(a.duration_min),
  timeZone: a.time_zone, videoUrl: a.video_url, prepNotes: a.prep_notes, report: a.report, status: a.status, revision: a.revision,
});
export type { ApptRow };

/** Texte de l’annonce, à l’heure locale du rendez-vous. */
function announce(a: AppointmentItem, canceled = false): string {
  const l = utcToLocal(new Date(a.startsAt), a.timeZone);
  return appointmentAnnouncement(a.kind, a.title, formatLongDate(l.date).toLowerCase(), l.time, a.durationMin, canceled);
}

/** createAppointment · C : rendez-vous avec un élève affecté, à l’heure locale du fuseau choisi. */
export async function createAppointment(meta: Meta, body: unknown): Promise<StoredResponse> {
  const v = parse<{ athleteId: string; title: string; kind: AppointmentKind; startsLocal: string; timeZone: string; durationMin: number; videoUrl: string | null; prepNotes: string | null; notify: boolean }>(createAppointmentSchema, body);
  if (!isTimeZone(v.timeZone)) throw invalid([{ path: 'timeZone', rule: 'Fuseau inconnu' }]);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireAssigned(tx, wid, v.athleteId);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'appointment.create', key: meta.idempotencyKey, body }, async () => {
      const r = await tx.query<ApptRow>(
        `insert into public.appointments(workspace_id, athlete_id, coach_id, title, kind, starts_at, duration_min, time_zone, video_url, prep_notes)
         values ($1, $2, auth.uid(), $3, $4, $5, $6, $7, $8, $9) returning ${apptCols}`,
        [wid, v.athleteId, v.title, v.kind, localToUtc(v.startsLocal, v.timeZone).toISOString(), v.durationMin, v.timeZone, v.videoUrl, v.prepNotes],
      );
      const item = toAppt(r.rows[0]!);
      let messageId: string | null = null;
      if (v.notify) messageId = await announceAppointment(tx, wid, v.athleteId, announce(item), item.id);
      await audit(tx, wid, meta.actorId, 'appointment.create', item.id, meta.requestId);
      return { status: 201, body: { item, messageId } };
    });
  });
}

/** updateAppointment · C : fait, annulé, préparation et compte rendu ; révision attendue. */
export async function updateAppointment(meta: Meta & { appointmentId: string }, body: unknown): Promise<StoredResponse> {
  const v = parse<{ expectedRevision: number; notify: boolean; status?: AppointmentStatus; prepNotes?: string | null; report?: string | null }>(updateAppointmentSchema, body);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const cur = await tx.query<{ athlete_id: string; revision: number }>(
      'select athlete_id, revision from public.appointments where workspace_id = $1 and id = $2 and coach_id = auth.uid() for update',
      [wid, meta.appointmentId],
    );
    const a = cur.rows[0];
    if (!a) throw notVisible();
    await requireAssigned(tx, wid, a.athlete_id);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'appointment.update', key: meta.idempotencyKey, body: { id: meta.appointmentId, ...v } }, async () => {
      if (a.revision !== v.expectedRevision) throw conflict('Ce rendez-vous a été modifié ailleurs. Recharge la page.', { revision: a.revision });
      const r = await tx.query<ApptRow>(
        `update public.appointments set
           status = coalesce($3, status),
           prep_notes = case when $4::boolean then $5 else prep_notes end,
           report = case when $6::boolean then $7 else report end,
           revision = revision + 1, updated_at = now()
         where workspace_id = $1 and id = $2 returning ${apptCols}`,
        [wid, meta.appointmentId, v.status ?? null, v.prepNotes !== undefined, v.prepNotes ?? null, v.report !== undefined, v.report ?? null],
      );
      const item = toAppt(r.rows[0]!);
      let messageId: string | null = null;
      if (v.notify && v.status === 'canceled') messageId = await announceAppointment(tx, wid, a.athlete_id, announce(item, true), item.id);
      await audit(tx, wid, meta.actorId, 'appointment.update', meta.appointmentId, meta.requestId);
      return { status: 200, body: { item, messageId } };
    });
  });
}

