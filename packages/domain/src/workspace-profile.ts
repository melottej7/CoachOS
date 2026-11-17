import { z } from 'zod';
import { LEVELS, LEVEL_LABELS, type Level } from './athlete-profile';
import { SPORTS } from './workout';

// Présentation de l’espace coach (D-022). Visible par les athlètes et les personnes invitées.

export const COACH_GOALS = ['5k10k', 'half', 'marathon', 'trail', 'ultra', 'tri_short', 'tri_long', 'bike', 'swim', 'comeback'] as const;
export type CoachGoal = (typeof COACH_GOALS)[number];
export const COACH_GOAL_LABELS: Record<CoachGoal, string> = {
  '5k10k': '5 à 10 km',
  half: 'Semi-marathon',
  marathon: 'Marathon',
  trail: 'Trail',
  ultra: 'Ultra-trail',
  tri_short: 'Triathlon courte distance',
  tri_long: 'Triathlon longue distance',
  bike: 'Cyclisme, gravel',
  swim: 'Natation, eau libre',
  comeback: 'Reprise du sport',
};

export const AUDIENCE_LABELS: Record<Level, string> = Object.fromEntries(LEVELS.map((l) => [l, LEVEL_LABELS[l].label])) as Record<Level, string>;

export const SPOKEN_LANGUAGES = ['fr', 'en', 'nl', 'de', 'es', 'it'] as const;
export type SpokenLanguage = (typeof SPOKEN_LANGUAGES)[number];
export const SPOKEN_LANGUAGE_LABELS: Record<SpokenLanguage, string> = {
  fr: 'Français', en: 'Anglais', nl: 'Néerlandais', de: 'Allemand', es: 'Espagnol', it: 'Italien',
};

/** Couleurs d’espace : palettes fixes, contrastes vérifiés en clair et en sombre (pas de couleur libre). */
export const ACCENTS = ['emerald', 'ocean', 'sunset', 'berry', 'slate', 'forest'] as const;
export type Accent = (typeof ACCENTS)[number];
export const ACCENT_LABELS: Record<Accent, string> = {
  emerald: 'Émeraude', ocean: 'Océan', sunset: 'Couchant', berry: 'Mûre', slate: 'Ardoise', forest: 'Forêt',
};
/** Couleur d’aperçu (mode clair) pour les pastilles du sélecteur. */
export const ACCENT_SWATCHES: Record<Accent, string> = {
  emerald: '#0a6452', ocean: '#1b5e9e', sunset: '#a34312', berry: '#8a2c63', slate: '#3d4f63', forest: '#2f6b1f',
};

const text = (max: number) =>
  z
    .string()
    .max(max, { message: `${max} caractères au plus` })
    .nullish()
    .transform((v) => {
      const t = v?.trim() ?? '';
      return t === '' ? null : t;
    });

const httpsUrl = z
  .string()
  .nullish()
  .transform((v) => {
    const t = v?.trim() ?? '';
    return t === '' ? null : t;
  })
  .refine((v) => v === null || (v.length <= 200 && /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v)), { message: 'Adresse commençant par https://' });

const tags = <T extends readonly [string, ...string[]]>(values: T, max: number) =>
  z
    .array(z.enum(values))
    .max(max)
    .default([])
    .transform((a) => [...new Set(a)]);

/** PUT /workspaces/{wid}/profile (propriétaire). Le nom de l’espace se modifie ici aussi. */
export const workspaceProfileSchema = z
  .object({
    name: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().min(1, { message: 'Saisir le nom de l’espace' }).max(120, { message: '120 caractères au plus' })),
    tagline: text(120),
    bio: text(1500),
    approach: text(1000),
    experienceYears: z.number().int().min(0).max(60).nullish().transform((v) => v ?? null),
    certifications: z
      .array(z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(120, { message: '120 caractères au plus' })))
      .max(10, { message: '10 au plus' })
      .default([]),
    sports: tags(SPORTS, 6),
    audiences: tags(LEVELS, 4),
    goals: tags(COACH_GOALS, 10),
    city: text(80),
    languages: tags(SPOKEN_LANGUAGES, 6),
    websiteUrl: httpsUrl,
    socialUrl: httpsUrl,
    contactEmail: z
      .string()
      .nullish()
      .transform((v) => (v?.trim().toLowerCase() || null))
      .refine((v) => v === null || (v.length <= 254 && z.email().safeParse(v).success), { message: 'Adresse e-mail invalide' }),
    accent: z.enum(ACCENTS).default('emerald'),
  })
  .strict();

export type WorkspaceProfileInput = z.output<typeof workspaceProfileSchema>;

/** Logo : formats acceptés, vérifiés par signature binaire (jamais SVG : risque de script). */
export const LOGO_MAX_BYTES = 512 * 1024;
export function detectImageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}
