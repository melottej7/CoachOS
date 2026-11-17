import { z } from 'zod';
import { isLocalDate, isTimeZone, type LocalDate } from './dates';

export const SPORTS = ['running', 'trail', 'cycling', 'swimming', 'triathlon', 'duathlon'] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  running: 'Course à pied',
  trail: 'Trail',
  cycling: 'Cyclisme',
  swimming: 'Natation',
  triathlon: 'Triathlon',
  duathlon: 'Duathlon',
};

const optionalText = (max: number) =>
  z
    .string()
    .max(max, { message: `${max} caractères au plus` })
    .nullish()
    .transform((v) => {
      const trimmed = v?.trim() ?? '';
      return trimmed === '' ? null : trimmed;
    });

const optionalInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullish().transform((v) => v ?? null);

/**
 * Entrée de séance (workoutInput). Bornes alignées sur la base (database/001_coachos.sql)
 * plutôt que sur les maxima génériques du contrat OpenAPI. Voir DECISIONS.md, D-007.
 */
export const workoutInputSchema = z
  .object({
    localDate: z.string().refine(isLocalDate, { message: 'Date invalide' }),
    timeZone: z.string().refine(isTimeZone, { message: 'Fuseau inconnu' }),
    sortOrder: z.number().int().min(0).max(10).default(0),
    sport: z.enum(SPORTS, { message: 'Sport non pris en charge' }),
    title: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().min(1, { message: 'Saisir un titre' }).max(120, { message: '120 caractères au plus' })),
    instructions: optionalText(5000),
    durationSeconds: optionalInt(1, 86400),
    distanceM: optionalInt(1, 1_000_000),
    intervals: z.array(z.unknown()).max(30).default([]),
  })
  .strict();

export type WorkoutInput = z.output<typeof workoutInputSchema>;

export const createWorkoutSchema = z
  .object({ planId: z.uuid().nullish(), data: workoutInputSchema })
  .strict();

export const updateWorkoutSchema = z
  .object({ expectedRevision: z.number().int().min(1), data: workoutInputSchema })
  .strict();

export const publishSchema = z
  .object({
    changes: z
      .array(z.object({ id: z.uuid(), revision: z.number().int().min(1) }).strict())
      .min(1)
      .max(50),
  })
  .strict();

export type WorkoutStatus = 'draft' | 'published' | 'changed';

/**
 * État visible par le coach.
 * - draft : jamais publiée, invisible pour l’athlète.
 * - published : l’athlète lit exactement la version de travail.
 * - changed : l’athlète lit une version publiée plus ancienne, un brouillon attend.
 */
export function workoutStatus(workingRevision: number, publishedRevision: number | null): WorkoutStatus {
  if (publishedRevision === null) return 'draft';
  return workingRevision === publishedRevision ? 'published' : 'changed';
}

export const WORKOUT_STATUS_LABELS: Record<WorkoutStatus, string> = {
  draft: 'Brouillon',
  published: 'Publiée',
  changed: 'Modifiée, non publiée',
};

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function formatDistance(meters: number | null): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 2 })} km`;
}

/** Un retour peut être donné sur une séance publiée, non annulée, à partir de son jour. */
export function canGiveFeedback(localDate: LocalDate, today: LocalDate, canceled: boolean): boolean {
  return !canceled && localDate <= today;
}
