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

export const TASK_RECURRENCES = ['weekly', 'biweekly', 'monthly'] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];
export const TASK_RECURRENCE_LABELS: Record<TaskRecurrence, string> = { weekly: 'Chaque semaine', biweekly: 'Toutes les 2 semaines', monthly: 'Chaque mois' };

/** Échéance de l’occurrence suivante (même jour du mois, ramené au dernier jour si besoin). */
export function nextOccurrence(due: string, r: TaskRecurrence): string {
  if (r !== 'monthly') return addDays(due, r === 'weekly' ? 7 : 14);
  const [y, m, d] = due.split('-').map(Number) as [number, number, number];
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Créneau de travail et durée estimée (CE-H-06, D-065). L’échéance dit « pour quand » ; le créneau, « quand je m’y mets ». */
const slotTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure au format 14:30' });
const estimate = z.number().int().min(5, { message: '5 minutes au moins' }).max(480, { message: '8 heures au plus' });

/** « 45 min », « 1 h », « 1 h 30 ». */
export function formatEstimate(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Occurrence suivante d’une tâche récurrente : le créneau garde le même écart avec l’échéance. */
export function nextSlot(due: string, nextDue: string, slotOn: string | null): string | null {
  if (!slotOn) return null;
  const gap = Math.round((Date.parse(`${slotOn}T12:00:00Z`) - Date.parse(`${due}T12:00:00Z`)) / 86_400_000);
  return addDays(nextDue, gap);
}

/**
 * Jour où la tâche se travaille : son créneau s’il précède l’échéance, sinon l’échéance (classement du Planning).
 * Un créneau passé n’est plus un plan : la tâche retrouve son échéance (elle n’est « en retard » que si l’échéance l’est).
 */
export function workDate(t: { dueOn: string | null; slotOn?: string | null }, today?: string): string | null {
  const slot = t.slotOn && (!today || t.slotOn >= today) ? t.slotOn : null;
  return slot && (!t.dueOn || slot < t.dueOn) ? slot : t.dueOn;
}

/** Charge estimée d’un jour : tâches dont le créneau est ce jour-là, et tâches sans créneau dues ce jour-là ou en retard. */
export function dayLoad(tasks: { dueOn: string | null; slotOn?: string | null; estimateMin?: number | null }[], day: string): { minutes: number; count: number; unknown: number } {
  const mine = tasks.filter((t) => (t.slotOn ? t.slotOn === day : t.dueOn !== null && t.dueOn <= day));
  return { minutes: mine.reduce((n, t) => n + (t.estimateMin ?? 0), 0), count: mine.length, unknown: mine.filter((t) => !t.estimateMin).length };
}

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
    /** CE-H-06 (D-059) : à la clôture, l’occurrence suivante est créée. Demande une échéance. */
    recurrence: z.enum(TASK_RECURRENCES).nullish().transform((v) => v ?? null),
    slotOn: optionalDate,
    slotTime: slotTime.nullish().transform((v) => v ?? null),
    estimateMin: estimate.nullish().transform((v) => v ?? null),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.recurrence && !v.dueOn) ctx.addIssue({ code: 'custom', path: ['dueOn'], message: 'Une tâche récurrente a besoin d’une échéance' });
    if (v.slotTime && !v.slotOn) ctx.addIssue({ code: 'custom', path: ['slotOn'], message: 'Choisis le jour du créneau' });
  });
export type CreateTaskInput = z.output<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    expectedRevision: z.number().int().min(1),
    status: z.enum(TASK_STATUSES).optional(),
    dueOn: optionalDate.optional(),
    priority: z.number().int().min(0).max(3).optional(),
    title: text(1, 200, 'Titre').optional(),
    notes: optionalText(2000, 'Notes').optional(),
    slotOn: optionalDate.optional(),
    slotTime: slotTime.nullable().optional(),
    estimateMin: estimate.nullable().optional(),
  })
  .strict();

// ---------- Suivis automatiques (CE-H-03) ----------

export const AUTO_RULES = ['feedback_review', 'no_upcoming', 'invite_pending', 'profile_missing', 'level_unconfirmed', 'vma_missing', 'message_reply', 'onboarding_call', 'bilan_confirm', 'readiness_talk'] as const;
export type AutoRule = (typeof AUTO_RULES)[number];
/** Libellé, type, priorité et motif expliqué de chaque règle. */
export const AUTO_RULE_INFO: Record<AutoRule, { title: string; kind: TaskKind; priority: Priority; reason: string }> = {
  feedback_review: { title: 'Examiner le retour', kind: 'review', priority: 2, reason: 'Retour envoyé, pas encore traité' },
  no_upcoming: { title: 'Préparer les prochaines séances', kind: 'program', priority: 2, reason: 'Aucune séance publiée sur les 7 prochains jours' },
  invite_pending: { title: 'Relancer l’invitation', kind: 'message', priority: 1, reason: 'Invité·e, pas encore connecté·e' },
  profile_missing: { title: 'Relancer le questionnaire', kind: 'questionnaire', priority: 1, reason: 'Profil sportif pas encore rempli' },
  level_unconfirmed: { title: 'Confirmer le niveau', kind: 'check', priority: 1, reason: 'Niveau déclaré, pas encore confirmé par toi' },
  message_reply: { title: 'Répondre au message', kind: 'message', priority: 2, reason: 'Message reçu, pas encore de réponse' },
  onboarding_call: { title: 'Planifier l’appel de bienvenue', kind: 'call', priority: 2, reason: 'Questionnaire reçu : un premier échange avant de construire le programme' },
  bilan_confirm: { title: 'Confirmer le bilan', kind: 'check', priority: 2, reason: 'Bilan envoyé, pas encore confirmé par toi' },
  vma_missing: { title: 'Renseigner la VMA', kind: 'check', priority: 0, reason: 'Information à vérifier : sans VMA, pas d’allure ni de kilomètres estimés' },
  // D-089 : réponse « pas à 100 % » (D-088) ; se clôt quand le coach écrit à l’élève ou quand l’élève répond « oui ».
  readiness_talk: { title: 'En parler avec l’élève', kind: 'call', priority: 3, reason: 'A répondu ne pas être à 100 % en ce moment' },
};
export const snoozeSchema = z.object({ rule: z.enum(AUTO_RULES), until: optionalDate }).strict();

// ---------- Réglage des suivis (CE-H-04, D-045) ----------

/**
 * Délai réglable de chaque règle. `null` : règle sans délai (information absente), activable seulement.
 * Pour `no_upcoming`, le délai est l’horizon regardé (« aucune séance sur les N prochains jours »).
 */
export const AUTO_RULE_DELAY: Record<AutoRule, { default: number; min: number; max: number; label: string } | null> = {
  message_reply: { default: 1, min: 0, max: 14, label: 'jour(s) après le message' },
  feedback_review: { default: 2, min: 0, max: 14, label: 'jour(s) après le retour' },
  onboarding_call: { default: 2, min: 0, max: 14, label: 'jour(s) après le questionnaire' },
  bilan_confirm: { default: 2, min: 0, max: 14, label: 'jour(s) après l’envoi du bilan' },
  readiness_talk: { default: 0, min: 0, max: 7, label: 'jour(s) après le retour' },
  invite_pending: { default: 3, min: 1, max: 30, label: 'jour(s) après l’invitation' },
  no_upcoming: { default: 7, min: 1, max: 21, label: 'prochains jours sans séance publiée' },
  profile_missing: null,
  level_unconfirmed: null,
  vma_missing: null,
};
/** Ordre d’affichage dans les réglages : du plus fréquent au plus rare. */
export const AUTO_RULE_ORDER: readonly AutoRule[] = ['readiness_talk', 'message_reply', 'feedback_review', 'no_upcoming', 'onboarding_call', 'bilan_confirm', 'invite_pending', 'profile_missing', 'level_unconfirmed', 'vma_missing'];

export interface AutoRuleSetting { rule: AutoRule; enabled: boolean; delayDays: number | null }

/** Réglages complets : ceux du coach, sinon les valeurs par défaut. */
export function resolveRuleSettings(saved: { rule: string; enabled: boolean; delay_days: number | null }[]): Record<AutoRule, AutoRuleSetting> {
  const out = {} as Record<AutoRule, AutoRuleSetting>;
  for (const rule of AUTO_RULES) {
    const s = saved.find((x) => x.rule === rule);
    const d = AUTO_RULE_DELAY[rule];
    out[rule] = { rule, enabled: s?.enabled ?? true, delayDays: d ? (s?.delay_days ?? d.default) : null };
  }
  return out;
}

/** Motif affiché, avec l’horizon réglé pour `no_upcoming`. */
export function autoRuleReason(rule: AutoRule, s: AutoRuleSetting): string {
  if (rule === 'no_upcoming') return `Aucune séance publiée sur les ${s.delayDays ?? 7} prochains jours`;
  return AUTO_RULE_INFO[rule].reason;
}

export const ruleSettingsSchema = z
  .object({
    rules: z
      .array(z.object({ rule: z.enum(AUTO_RULES), enabled: z.boolean(), delayDays: z.number().int().min(0).max(30).nullable() }).strict())
      .min(1)
      .max(AUTO_RULES.length),
  })
  .strict()
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.rules.forEach((r, i) => {
      if (seen.has(r.rule)) ctx.addIssue({ code: 'custom', path: ['rules', i, 'rule'], message: 'Règle en double' });
      seen.add(r.rule);
      const d = AUTO_RULE_DELAY[r.rule];
      if (!d && r.delayDays !== null) ctx.addIssue({ code: 'custom', path: ['rules', i, 'delayDays'], message: 'Cette règle n’a pas de délai' });
      if (d && (r.delayDays === null || r.delayDays < d.min || r.delayDays > d.max)) {
        ctx.addIssue({ code: 'custom', path: ['rules', i, 'delayDays'], message: `Entre ${d.min} et ${d.max} jours` });
      }
    });
  });

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
    /** Annoncer le rendez-vous à l’élève dans la conversation (envoi explicite, case visible). */
    notify: z.boolean().default(false),
  })
  .strict();
export const updateAppointmentSchema = z
  .object({
    expectedRevision: z.number().int().min(1),
    notify: z.boolean().default(false),
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

/** Lien de visioconférence prêt à l’emploi (Jitsi Meet, sans compte) : nom de salle aléatoire, aucune donnée personnelle. */
export function newVideoLink(random: () => number = Math.random): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const id = Array.from({ length: 12 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
  return `https://meet.jit.si/CoachOS-${id}`;
}

/** Texte de l’annonce dans la conversation : « 📅 Visioconférence prévue jeudi 20 novembre à 18:30 (30 min) ». */
export function appointmentAnnouncement(kind: AppointmentKind, title: string, dateLabel: string, time: string, durationMin: number, canceled = false): string {
  const what = kind === 'video' ? 'Appel vidéo' : kind === 'call' ? 'Appel' : 'Rendez-vous';
  return canceled
    ? `❌ ${what} annulé : ${title}, ${dateLabel} à ${time}`
    : `📅 ${what} prévu ${dateLabel} à ${time} (${durationMin} min) : ${title}`;
}
