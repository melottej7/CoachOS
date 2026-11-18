import { z } from 'zod';

// Repères d’entraînement fixés par le coach (CE-B-03, D-029). Aucune donnée de santé.

/** PUT /workspaces/{wid}/athletes/{aid}/references. VMA en km/h, une décimale ; null pour effacer. */
export const athleteReferencesSchema = z
  .object({
    vmaKmh: z
      .number({ message: 'VMA : un nombre en km/h' })
      .min(6, { message: 'VMA : entre 6 et 30 km/h' })
      .max(30, { message: 'VMA : entre 6 et 30 km/h' })
      .transform((v) => Math.round(v * 10) / 10)
      .nullable(),
  })
  .strict();
export type AthleteReferencesInput = z.output<typeof athleteReferencesSchema>;
