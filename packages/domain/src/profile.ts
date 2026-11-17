import { z } from 'zod';
import { isTimeZone } from './dates';

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_LABELS: Record<Locale, string> = { fr: 'Français', en: 'English (bientôt)' };

/** PATCH /me (C02-07) : au moins un champ ; nom 100 caractères au plus. */
export const updateMeSchema = z
  .object({
    displayName: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().min(1, { message: 'Saisir un nom' }).max(100, { message: '100 caractères au plus' }))
      .nullish()
      .transform((v) => v ?? null),
    locale: z.enum(LOCALES, { message: 'Langue non prise en charge' }).nullish().transform((v) => v ?? null),
  })
  .strict()
  .refine((v) => v.displayName !== null || v.locale !== null, { message: 'Au moins un champ à modifier', path: ['displayName'] });

/** PATCH /workspaces/{wid}/athlete-settings : fuseau de la relation, sans redater les séances existantes. */
export const athleteSettingsSchema = z
  .object({ timeZone: z.string().max(80).refine(isTimeZone, { message: 'Fuseau horaire inconnu' }) })
  .strict();
