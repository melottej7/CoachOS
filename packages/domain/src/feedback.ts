import { z } from 'zod';
import { SPORTS } from './sports';

export const RESULT_STATES = ['completed', 'partial', 'postponed', 'missed'] as const;
export type ResultState = (typeof RESULT_STATES)[number];

export const RESULT_STATE_LABELS: Record<ResultState, string> = {
  completed: 'Réalisée',
  partial: 'Partiellement réalisée',
  postponed: 'Reportée',
  missed: 'Non réalisée',
};

/** Ressenti général (1 à 5). */
export const FEELING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = { 1: 'Épuisé·e', 2: 'Fatigué·e', 3: 'Correct', 4: 'Bien', 5: 'Excellent' };

/** Difficultés particulières : catégories fermées, non médicales (D11, D-025). */
export const DIFFICULTIES = ['fatigue', 'weather', 'terrain', 'gear', 'time', 'motivation', 'other'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  fatigue: 'Fatigue', weather: 'Météo', terrain: 'Terrain, parcours', gear: 'Matériel', time: 'Manque de temps', motivation: 'Motivation', other: 'Autre',
};

/** Ce qui a changé par rapport au prévu (CE-E-05, D-031). Catégories fermées, non médicales. */
export const CHANGES = ['shorter', 'fewer_reps', 'easier', 'harder', 'other_route', 'other_sport', 'stopped'] as const;
export type Change = (typeof CHANGES)[number];
export const CHANGE_LABELS: Record<Change, string> = {
  shorter: 'Plus courte', fewer_reps: 'Moins de répétitions', easier: 'Moins intense', harder: 'Plus intense',
  other_route: 'Autre parcours', other_sport: 'Autre sport', stopped: 'Arrêtée en cours',
};

/**
 * PUT feedback. RPE 0 à 10 (PRD §21, C06-04), commentaire 1000 caractères (SQL).
 * Une chaîne vide devient null. Pour « missed », durée et distance ne sont pas supposées.
 */
export const saveFeedbackSchema = z
  .object({
    publishedRevision: z.number().int().min(1),
    expectedRevision: z.number().int().min(1).nullish().transform((v) => v ?? null),
    state: z.enum(RESULT_STATES, { message: 'Choisir un état' }),
    durationSeconds: z.number().int().min(1, { message: 'Durée positive' }).max(86400, { message: '24 h au plus' }).nullish().transform((v) => v ?? null),
    distanceM: z.number().int().min(1).max(1_000_000).nullish().transform((v) => v ?? null),
    rpe: z.number().int({ message: 'Nombre entier' }).min(0, { message: 'Entre 0 et 10' }).max(10, { message: 'Entre 0 et 10' }).nullish().transform((v) => v ?? null),
    comment: z
      .string()
      .max(1000, { message: '1000 caractères au plus' })
      .nullish()
      .transform((v) => {
        const t = v?.trim() ?? '';
        return t === '' ? null : t;
      }),
    overallFeeling: z.number().int().min(1).max(5).nullish().transform((v) => v ?? null),
    difficulties: z.array(z.enum(DIFFICULTIES)).max(7).default([]).transform((a) => [...new Set(a)]),
    changes: z.array(z.enum(CHANGES)).max(7).default([]).transform((a) => [...new Set(a)]),
    actualSport: z.enum(SPORTS).nullish().transform((v) => v ?? null),
    /** Répétitions faites, une valeur par série principale du déroulé, dans l’ordre. */
    repeatsDone: z.array(z.number().int().min(0, { message: '0 au moins' }).max(50, { message: '50 au plus' })).max(30).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.state === 'missed' || value.state === 'postponed') && (value.durationSeconds !== null || value.distanceM !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationSeconds'],
        message: 'Une séance non réalisée ou reportée ne porte ni durée ni distance',
      });
    }
    if ((value.state === 'missed' || value.state === 'postponed') && (value.changes.length || value.actualSport !== null || value.repeatsDone.length)) {
      ctx.addIssue({ code: 'custom', path: ['changes'], message: 'Une séance non réalisée ou reportée ne décrit pas ce qui a changé' });
    }
  });

export type SaveFeedbackInput = z.output<typeof saveFeedbackSchema>;

export const markReviewedSchema = z.object({ expectedRevision: z.number().int().min(1) }).strict();
