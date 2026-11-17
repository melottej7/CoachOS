import { z } from 'zod';
import { isLocalDate } from './dates';
import { SPORTS } from './workout';

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

/** PUT /workspaces/{wid}/athlete-profile. Propriétés inconnues refusées (pas de champ santé caché). */
export const athleteProfileSchema = z
  .object({
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
  })
  .strict();

export type AthleteProfileInput = z.output<typeof athleteProfileSchema>;
