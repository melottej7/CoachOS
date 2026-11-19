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
    /** FTP en watts (vélo, D-055). Absent = inchangé. */
    ftpW: z.number({ message: 'FTP : un nombre en watts' }).int({ message: 'FTP : un nombre entier de watts' })
      .min(50, { message: 'FTP : entre 50 et 600 W' }).max(600, { message: 'FTP : entre 50 et 600 W' }).nullable().optional(),
    /** CSS en secondes pour 100 m (natation, D-055). Absent = inchangé. */
    cssSecPer100: z.number({ message: 'CSS : une allure pour 100 m' }).int()
      .min(50, { message: 'CSS : entre 0:50 et 5:00 /100 m' }).max(300, { message: 'CSS : entre 0:50 et 5:00 /100 m' }).nullable().optional(),
  })
  .strict();

/** « 1:45 » ou « 105 » → 105 secondes ; null si illisible. */
export function parseSwimPace(text: string): number | null {
  const t = text.trim().replace(/\s*\/\s*100\s*m?$/i, '');
  const m = t.match(/^(\d{1,2})[:'’](\d{2})$/);
  if (m) return Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
  return /^\d{2,3}$/.test(t) ? Number(t) : null;
}
export type AthleteReferencesInput = z.output<typeof athleteReferencesSchema>;
