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

/**
 * D-088 (instruction du fondateur, version « sans le corps ») : « Peux-tu faire tes séances à 100 % en ce moment ? »
 * Trois réponses fermées, sans cause : le coach en parle avec l’élève. Aucune donnée de santé n’est demandée (D-084).
 */
export const READINESS = ['full', 'not_quite', 'no'] as const;
export type Readiness = (typeof READINESS)[number];
export const READINESS_QUESTION = 'Peux-tu faire tes séances à 100 % en ce moment ?';
export const READINESS_LABELS: Record<Readiness, string> = { full: 'Oui', not_quite: 'Pas tout à fait', no: 'Non' };
/** Vu par le coach : la réponse en clair. */
export const READINESS_COACH: Record<Readiness, string> = { full: 'À 100 %', not_quite: 'Pas tout à fait à 100 %', no: 'Pas à 100 %' };
export const readinessAlert = (r: Readiness | null | undefined) => r === 'not_quite' || r === 'no';

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
/**
 * Résumé d’une activité lue dans un fichier de montre (D-048), rattachée à une séance (CE-X-03, D-064).
 * Ni fréquence cardiaque, ni puissance, ni positions : sport, début, durée et distance seulement.
 */
export const feedbackActivitySchema = z
  .object({
    format: z.enum(['fit', 'tcx', 'gpx']),
    sport: z.enum(SPORTS).nullish().transform((v) => v ?? null),
    startedAt: z.iso.datetime({ message: 'Date invalide' }).nullish().transform((v) => v ?? null),
    seconds: z.number().int().min(1).max(86400).nullish().transform((v) => v ?? null),
    distanceM: z.number().int().min(1).max(1_000_000).nullish().transform((v) => v ?? null),
  })
  .strict()
  .refine((a) => a.seconds !== null || a.distanceM !== null, { message: 'Activité sans durée ni distance' });
export type FeedbackActivity = z.output<typeof feedbackActivitySchema>;

/** Empreinte d’une activité : le même fichier importé deux fois est reconnu (aucun double comptage). */
export function activityFingerprint(a: Pick<FeedbackActivity, 'format' | 'sport' | 'startedAt' | 'seconds' | 'distanceM'>): string {
  const start = a.startedAt ? new Date(a.startedAt).toISOString() : '-';
  return [a.format, a.sport ?? '-', start, a.seconds ?? '-', a.distanceM ?? '-'].join('|');
}

/** Durée et distance cumulées de plusieurs activités (null si aucune n’en porte). */
export function activityTotals(list: Pick<FeedbackActivity, 'seconds' | 'distanceM'>[]): { seconds: number | null; distanceM: number | null } {
  const sec = list.reduce((n, a) => n + (a.seconds ?? 0), 0);
  const dist = list.reduce((n, a) => n + (a.distanceM ?? 0), 0);
  return { seconds: sec > 0 ? Math.min(86400, sec) : null, distanceM: dist > 0 ? Math.min(1_000_000, dist) : null };
}

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
    readiness: z.enum(READINESS).nullish().transform((v) => v ?? null),
    difficulties: z.array(z.enum(DIFFICULTIES)).max(7).default([]).transform((a) => [...new Set(a)]),
    changes: z.array(z.enum(CHANGES)).max(7).default([]).transform((a) => [...new Set(a)]),
    actualSport: z.enum(SPORTS).nullish().transform((v) => v ?? null),
    /** Répétitions faites, une valeur par série principale du déroulé, dans l’ordre. */
    repeatsDone: z.array(z.number().int().min(0, { message: '0 au moins' }).max(50, { message: '50 au plus' })).max(30).default([]),
    /** Durée et distance lues dans un fichier de montre (D-048) ; null = saisies à la main. */
    measureFile: z.enum(['fit', 'tcx', 'gpx']).nullish().transform((v) => v ?? null),
    /** Activités de la montre rattachées à cette séance (CE-X-03, D-064) : résumés seulement, jamais le fichier. */
    activities: z.array(feedbackActivitySchema).max(10, { message: '10 activités au plus' }).default([]),
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
    if ((value.state === 'missed' || value.state === 'postponed') && value.activities.length) {
      ctx.addIssue({ code: 'custom', path: ['activities'], message: 'Une séance non réalisée ou reportée ne porte pas d’activité' });
    }
    const prints = value.activities.map(activityFingerprint);
    if (new Set(prints).size !== prints.length) {
      ctx.addIssue({ code: 'custom', path: ['activities'], message: 'La même activité est ajoutée deux fois' });
    }
    if (value.measureFile !== null && value.durationSeconds === null && value.distanceM === null) {
      ctx.addIssue({ code: 'custom', path: ['measureFile'], message: 'Aucune mesure tirée du fichier' });
    }
  });

export type SaveFeedbackInput = z.output<typeof saveFeedbackSchema>;

export const markReviewedSchema = z.object({ expectedRevision: z.number().int().min(1) }).strict();
