import { z } from 'zod';
import { isLocalDate } from './dates';
import { SPORTS } from './workout';
import type { Sport } from './sports';

// Profil sportif déclaré par l’athlète (D-021). Aucune donnée de santé.

export const LEVELS = ['beginner', 'intermediate', 'advanced', 'competitive'] as const;
export const EXPERIENCES = ['lt1', '1to3', '3to5', 'gt5'] as const;
export const WEEKLY_SESSIONS = ['0to1', '2to3', '4to5', '6plus'] as const;
export const WEEKLY_HOURS = ['lt2', '2to4', '4to6', '6to10', 'gt10'] as const;

export type Level = (typeof LEVELS)[number];
export type Experience = (typeof EXPERIENCES)[number];
export type WeeklySessions = (typeof WEEKLY_SESSIONS)[number];
export type WeeklyHours = (typeof WEEKLY_HOURS)[number];

export const LEVEL_LABELS: Record<Level, { label: string; hint: string }> = {
  beginner: { label: 'Je débute', hint: 'Je commence ou je reprends après une longue pause.' },
  intermediate: { label: 'Intermédiaire', hint: 'Je m’entraîne régulièrement sans viser de chrono.' },
  advanced: { label: 'Confirmé·e', hint: 'Je suis un plan et je connais mes allures ou zones.' },
  competitive: { label: 'Compétiteur·rice', hint: 'Je prépare des compétitions avec des objectifs de résultat.' },
};
export const EXPERIENCE_LABELS: Record<Experience, string> = { lt1: 'Moins d’un an', '1to3': '1 à 3 ans', '3to5': '3 à 5 ans', gt5: 'Plus de 5 ans' };
export const WEEKLY_SESSIONS_LABELS: Record<WeeklySessions, string> = { '0to1': '0 ou 1', '2to3': '2 ou 3', '4to5': '4 ou 5', '6plus': '6 ou plus' };
export const WEEKLY_HOURS_LABELS: Record<WeeklyHours, string> = { lt2: 'Moins de 2 h', '2to4': '2 à 4 h', '4to6': '4 à 6 h', '6to10': '6 à 10 h', gt10: 'Plus de 10 h' };
export const DAY_LABELS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'] as const; // index + 1 = jour ISO

const optionalText = (max: number) =>
  z
    .string()
    .max(max, { message: `${max} caractères au plus` })
    .nullish()
    .transform((v) => {
      const t = v?.trim() ?? '';
      return t === '' ? null : t;
    });

// ---------- Bilan (CE-B-04, CE-B-05, D-054), inspiré du questionnaire de Foulée ----------
// Une question par écran, questions conditionnelles, pratique réelle des 4 dernières semaines. Aucune donnée de santé.

export const PRACTICE_STATUSES = ['regular', 'resumed', 'stopped', 'beginner'] as const;
export const BREAK_LENGTHS = ['lt1m', '1to3m', '3to6m', '6to12m', '1to3y', 'gt3y'] as const;
export const RESUMED_SINCE = ['lt1m', '1to3m', 'gt3m'] as const;
export const LONGEST_RECENT = ['lt20', '20to30', '30to45', '45to60', '60to90', '90to120', 'gt120'] as const;
export type PracticeStatus = (typeof PRACTICE_STATUSES)[number];
export type BreakLength = (typeof BREAK_LENGTHS)[number];
export type ResumedSince = (typeof RESUMED_SINCE)[number];
export type LongestRecent = (typeof LONGEST_RECENT)[number];

export const PRACTICE_STATUS_LABELS: Record<PracticeStatus, string> = {
  regular: 'Je pratique régulièrement, sans coupure depuis au moins 3 mois',
  resumed: 'J’ai repris après un arrêt',
  stopped: 'J’ai arrêté, et je n’ai pas encore repris',
  beginner: 'Je débute : je n’ai jamais pratiqué régulièrement',
};
export const BREAK_LENGTH_LABELS: Record<BreakLength, string> = {
  lt1m: 'Moins d’1 mois', '1to3m': '1 à 3 mois', '3to6m': '3 à 6 mois', '6to12m': '6 mois à 1 an', '1to3y': '1 à 3 ans', gt3y: 'Plus de 3 ans',
};
export const RESUMED_SINCE_LABELS: Record<ResumedSince, string> = { lt1m: 'Depuis moins d’1 mois', '1to3m': 'Depuis 1 à 3 mois', gt3m: 'Depuis plus de 3 mois' };
export const LONGEST_RECENT_LABELS: Record<LongestRecent, string> = {
  lt20: 'Moins de 20 minutes', '20to30': '20 à 30 minutes', '30to45': '30 à 45 minutes', '45to60': '45 minutes à 1 h',
  '60to90': '1 h à 1 h 30', '90to120': '1 h 30 à 2 h', gt120: 'Plus de 2 h',
};

const optEnum = <T extends readonly [string, ...string[]]>(v: T) => z.enum(v).nullish().transform((x) => x ?? null);

// ---------- Temps, matériel et préférences (D-066) ----------

/** Matériel et accès utiles pour construire les séances. Aucun capteur de fréquence cardiaque (décision santé en attente). */
export const EQUIPMENT = ['gps_watch', 'power_meter', 'home_trainer', 'road_bike', 'offroad_bike', 'treadmill', 'track', 'pool', 'open_water', 'gym'] as const;
export type Equipment = (typeof EQUIPMENT)[number];
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  gps_watch: 'Montre GPS', power_meter: 'Capteur de puissance', home_trainer: 'Home trainer', road_bike: 'Vélo de route', offroad_bike: 'VTT ou gravel',
  treadmill: 'Tapis de course', track: 'Accès à une piste d’athlétisme', pool: 'Accès à une piscine', open_water: 'Eau libre (lac, mer)', gym: 'Salle de renforcement',
};
const BY_SPORT: Record<Sport, Equipment[]> = {
  running: ['gps_watch', 'treadmill', 'track', 'gym'],
  trail: ['gps_watch', 'treadmill', 'track', 'gym'],
  cycling: ['gps_watch', 'power_meter', 'home_trainer', 'road_bike', 'offroad_bike', 'gym'],
  swimming: ['pool', 'open_water', 'gps_watch', 'gym'],
  triathlon: [...EQUIPMENT],
  duathlon: ['gps_watch', 'power_meter', 'home_trainer', 'road_bike', 'offroad_bike', 'treadmill', 'track', 'gym'],
};
/** Matériel proposé pour un sport. */
export const equipmentFor = (sport: Sport | null | undefined): Equipment[] => (sport ? BY_SPORT[sport] : [...EQUIPMENT]);

export const PREFERRED_TIMES = ['morning', 'noon', 'evening', 'variable'] as const;
export type PreferredTime = (typeof PREFERRED_TIMES)[number];
export const PREFERRED_TIME_LABELS: Record<PreferredTime, string> = { morning: 'Le matin', noon: 'Le midi', evening: 'Le soir', variable: 'Ça dépend' };

/** Temps disponible pour une séance un jour de semaine (lundi à vendredi). */
export const WEEKDAY_MINUTES = ['lt45', '45to60', '60to90', 'gt90'] as const;
export type WeekdayMinutes = (typeof WEEKDAY_MINUTES)[number];
export const WEEKDAY_MINUTES_LABELS: Record<WeekdayMinutes, string> = { lt45: 'Moins de 45 min', '45to60': '45 min à 1 h', '60to90': '1 h à 1 h 30', gt90: 'Plus d’1 h 30' };
/** Plafond en minutes, pour signaler une séance trop longue en semaine (null : pas de plafond). */
export const WEEKDAY_MINUTES_CAP: Record<WeekdayMinutes, number | null> = { lt45: 45, '45to60': 60, '60to90': 90, gt90: null };

/** PUT /workspaces/{wid}/athlete-profile. Propriétés inconnues refusées (pas de champ santé caché). */
export const athleteProfileSchema = z
  .object({
    practiceStatus: optEnum(PRACTICE_STATUSES),
    breakLength: optEnum(BREAK_LENGTHS),
    resumedSince: optEnum(RESUMED_SINCE),
    longestRecent: optEnum(LONGEST_RECENT),
    sport: z.enum(SPORTS, { message: 'Choisir un sport' }),
    level: z.enum(LEVELS, { message: 'Choisir un niveau' }),
    experience: z.enum(EXPERIENCES, { message: 'Choisir une ancienneté' }),
    weeklySessions: z.enum(WEEKLY_SESSIONS, { message: 'Choisir un nombre de séances' }),
    weeklyHours: z.enum(WEEKLY_HOURS).nullish().transform((v) => v ?? null),
    availableDays: z
      .array(z.number().int().min(1).max(7))
      .max(7)
      .default([])
      .transform((days) => [...new Set(days)].sort()),
    mainGoal: optionalText(300),
    nextEventName: optionalText(120),
    nextEventDate: z
      .string()
      .refine(isLocalDate, { message: 'Date invalide' })
      .nullish()
      .transform((v) => v ?? null),
    /** D-066 : temps disponible en semaine, moment préféré, jour préféré pour la séance longue, matériel, contraintes utiles. */
    weekdayMinutes: optEnum(WEEKDAY_MINUTES),
    preferredTime: optEnum(PREFERRED_TIMES),
    longDay: z.number().int().min(1).max(7).nullish().transform((v) => v ?? null),
    equipment: z.array(z.enum(EQUIPMENT)).max(EQUIPMENT.length).default([]).transform((e) => [...new Set(e)].sort()),
    practicalConstraints: optionalText(300),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.practiceStatus === 'resumed' || v.practiceStatus === 'stopped') && !v.breakLength) {
      ctx.addIssue({ code: 'custom', path: ['breakLength'], message: 'Indique la durée de l’arrêt' });
    }
    if (v.practiceStatus === 'resumed' && !v.resumedSince) ctx.addIssue({ code: 'custom', path: ['resumedSince'], message: 'Indique depuis quand tu as repris' });
  });

export type AthleteProfileInput = z.output<typeof athleteProfileSchema>;

