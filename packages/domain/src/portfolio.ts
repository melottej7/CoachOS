import { z } from 'zod';
import { LEVELS } from './athlete-profile';
import { addDays, isLocalDate, type LocalDate } from './dates';
import { SPORTS } from './sports';

// Lots G et H (D-032) : groupes, niveaux confirmés, objectifs, notes privées, tâches et rendez-vous.

const text = (min: number, max: number, label: string) =>
  z
    .string({ message: `${label} : texte attendu` })
    .transform((v) => v.trim())
    .pipe(z.string().min(min, { message: `${label} : à remplir` }).max(max, { message: `${label} : ${max} caractères au plus` }));
const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, { message: `${label} : ${max} caractères au plus` })
    .nullish()
    .transform((v) => {
      const t = v?.trim() ?? '';
      return t === '' ? null : t;
    });
const localDate = z.string().refine(isLocalDate, { message: 'Date invalide' });
const optionalDate = localDate.nullish().transform((v) => (v ?? null) as LocalDate | null);

// ---------- Groupes (CE-G-01, CE-G-02) ----------

export const createTeamSchema = z.object({ name: text(1, 60, 'Nom du groupe') }).strict();
export const updateTeamSchema = z
  .object({
    name: text(1, 60, 'Nom du groupe').optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.sortOrder !== undefined || v.archived !== undefined, { message: 'Rien à modifier' });

// ---------- Niveau par sport (CE-G-05) ----------

export const confirmLevelSchema = z
  .object({ sport: z.enum(SPORTS, { message: 'Choisir un sport' }), level: z.enum(LEVELS, { message: 'Choisir un niveau' }) })
  .strict();

// ---------- Objectifs (CE-G-08) et notes privées (CE-G-07) ----------

export const GOAL_STATES = ['planned', 'achieved', 'canceled'] as const;
export type GoalState = (typeof GOAL_STATES)[number];
export const GOAL_STATE_LABELS: Record<GoalState, string> = { planned: 'En cours', achieved: 'Atteint', canceled: 'Abandonné' };
export const createGoalSchema = z
  .object({ title: text(1, 200, 'Objectif'), sport: z.enum(SPORTS, { message: 'Choisir un sport' }), targetDate: optionalDate })
  .strict();
export const updateGoalSchema = z.object({ state: z.enum(GOAL_STATES), targetDate: optionalDate.optional() }).strict();

export const createNoteSchema = z.object({ body: text(1, 2000, 'Note') }).strict();

// ---------- Tâches (CE-H-02) ----------

export const TASK_KINDS = ['message', 'review', 'program', 'questionnaire', 'call', 'check', 'other'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  message: 'Répondre ou écrire', review: 'Examiner un retour', program: 'Préparer le programme', questionnaire: 'Relancer un questionnaire',
  call: 'Appel ou bilan', check: 'Vérifier une information', other: 'Autre',
};
export const TASK_STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'postponed', 'canceled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire', in_progress: 'En cours', waiting: 'En attente', done: 'Terminée', postponed: 'Reportée', canceled: 'Annulée',
};
export const OPEN_TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'waiting', 'postponed'];
export const PRIORITIES = [0, 1, 2, 3] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = { 0: 'Basse', 1: 'Normale', 2: 'Haute', 3: 'Urgente' };

/** Transitions autorisées : une tâche close (terminée, annulée) peut être rouverte en « à faire ». */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress', 'waiting', 'done', 'postponed', 'canceled'],
  in_progress: ['todo', 'waiting', 'done', 'postponed', 'canceled'],
  waiting: ['todo', 'in_progress', 'done', 'postponed', 'canceled'],
  postponed: ['todo', 'in_progress', 'waiting', 'done', 'canceled'],
  done: ['todo'],
  canceled: ['todo'],
};
export const canTransition = (from: TaskStatus, to: TaskStatus) => from === to || TASK_TRANSITIONS[from].includes(to);

const coachLink = z
  .string()
  .max(300)
  .refine((v) => /^\/coach\/[0-9a-f-]{36}(\/[A-Za-z0-9/_\-?=&.%]*)?$/.test(v), { message: 'Lien interne attendu' })
  .nullish()
  .transform((v) => v ?? null);

export const createTaskSchema = z
  .object({
    title: text(1, 200, 'Titre'),
    kind: z.enum(TASK_KINDS, { message: 'Choisir un type' }),
    athleteId: z.uuid().nullish().transform((v) => v ?? null),
    teamId: z.uuid().nullish().transform((v) => v ?? null),
    dueOn: optionalDate,
    priority: z.number().int().min(0).max(3).default(1),
    link: coachLink,
    notes: optionalText(2000, 'Notes'),
  })
  .strict();
export type CreateTaskInput = z.output<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    expectedRevision: z.number().int().min(1),
    status: z.enum(TASK_STATUSES).optional(),
    dueOn: optionalDate.optional(),
    priority: z.number().int().min(0).max(3).optional(),
    title: text(1, 200, 'Titre').optional(),
    notes: optionalText(2000, 'Notes').optional(),
  })
  .strict();

// ---------- Suivis automatiques (CE-H-03) ----------

export const AUTO_RULES = ['feedback_review', 'no_upcoming', 'invite_pending', 'profile_missing', 'level_unconfirmed', 'vma_missing'] as const;
export type AutoRule = (typeof AUTO_RULES)[number];
/** Libellé, type, priorité et motif expliqué de chaque règle. */
export const AUTO_RULE_INFO: Record<AutoRule, { title: string; kind: TaskKind; priority: Priority; reason: string }> = {
  feedback_review: { title: 'Examiner le retour', kind: 'review', priority: 2, reason: 'Retour envoyé, pas encore traité' },
  no_upcoming: { title: 'Préparer les prochaines séances', kind: 'program', priority: 2, reason: 'Aucune séance publiée sur les 7 prochains jours' },
  invite_pending: { title: 'Relancer l’invitation', kind: 'message', priority: 1, reason: 'Invité·e, pas encore connecté·e' },
  profile_missing: { title: 'Relancer le questionnaire', kind: 'questionnaire', priority: 1, reason: 'Profil sportif pas encore rempli' },
  level_unconfirmed: { title: 'Confirmer le niveau', kind: 'check', priority: 1, reason: 'Niveau déclaré, pas encore confirmé par toi' },
  vma_missing: { title: 'Renseigner la VMA', kind: 'check', priority: 0, reason: 'Information à vérifier : sans VMA, pas d’allure ni de kilomètres estimés' },
};
export const snoozeSchema = z.object({ rule: z.enum(AUTO_RULES), until: optionalDate }).strict();

// ---------- Rendez-vous (CE-H-05) ----------

export const APPOINTMENT_KINDS = ['video', 'call', 'in_person'] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];
export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = { video: 'Visioconférence', call: 'Appel', in_person: 'Rencontre' };
export const APPOINTMENT_STATUSES = ['planned', 'done', 'canceled'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = { planned: 'Prévu', done: 'Fait', canceled: 'Annulé' };

export const createAppointmentSchema = z
  .object({
    athleteId: z.uuid({ message: 'Choisir un élève' }),
    title: text(1, 120, 'Titre'),
    kind: z.enum(APPOINTMENT_KINDS),
    /** Heure locale dans le fuseau donné : « 2026-11-20T18:30 ». */
    startsLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { message: 'Date et heure invalides' }),
    timeZone: z.string().min(1).max(64),
    durationMin: z.number().int().min(5, { message: '5 min au moins' }).max(480, { message: '8 h au plus' }),
    videoUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https:\/\/[^\s]+$/.test(v), { message: 'Lien commençant par https://' })
      .nullish()
      .transform((v) => (v ? v : null)),
    prepNotes: optionalText(4000, 'Préparation'),
  })
  .strict();
export const updateAppointmentSchema = z
  .object({
    expectedRevision: z.number().int().min(1),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
    prepNotes: optionalText(4000, 'Préparation').optional(),
    report: optionalText(8000, 'Compte rendu').optional(),
  })
  .strict();

// ---------- Classement explicable (CE-H-01) ----------

export type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';
export const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'En retard', today: 'Aujourd’hui', week: 'Cette semaine', later: 'Plus tard', none: 'Sans échéance',
};
export const BUCKETS: Bucket[] = ['overdue', 'today', 'week', 'later', 'none'];

export function bucketOf(dueOn: string | null, today: LocalDate): Bucket {
  if (!dueOn) return 'none';
  if (dueOn < today) return 'overdue';
  if (dueOn === today) return 'today';
  if (dueOn <= addDays(today, 6)) return 'week';
  return 'later';
}

export interface Rankable { dueOn: string | null; priority: number; title: string }

/** Ordre : échéance (en retard d’abord), puis priorité, puis date, puis titre. */
export function rankTasks<T extends Rankable>(tasks: T[], today: LocalDate): T[] {
  const order = (t: T) => BUCKETS.indexOf(bucketOf(t.dueOn, today));
  return [...tasks].sort(
    (a, b) => order(a) - order(b) || b.priority - a.priority || (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999') || a.title.localeCompare(b.title, 'fr'),
  );
}

/** Urgence d’un élève : priorité + 1 par suivi ouvert, +2 par élément en retard. */
export function urgencyScore(items: { priority: number; dueOn: string | null }[], today: LocalDate): number {
  return items.reduce((n, i) => n + i.priority + 1 + (i.dueOn && i.dueOn < today ? 2 : 0), 0);
}
/** « Urgent » demande du retard ou une accumulation (6 points : par ex. un retour à examiner en retard et un autre suivi). */
export function urgencyLabel(score: number): 'Urgent' | 'À suivre' | 'À jour' {
  return score >= 6 ? 'Urgent' : score > 0 ? 'À suivre' : 'À jour';
}
