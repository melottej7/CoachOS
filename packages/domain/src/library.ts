import { z } from 'zod';
import { PRESETS } from './presets';
import type { Sport } from './sports';
import { workoutInputSchema } from './workout';
import type { Block } from './structure';
import { isLocalDate } from './dates';

// Bibliothèque de séances du coach (CE-B-01, D-035) : séances réutilisables, sans date ni élève.

export const LIBRARY_CATEGORIES = ['endurance', 'tempo', 'threshold', 'intervals', 'hills', 'long', 'recovery', 'technique', 'strength', 'race', 'other'] as const;
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];
export const LIBRARY_CATEGORY_LABELS: Record<LibraryCategory, string> = {
  endurance: 'Endurance', tempo: 'Tempo', threshold: 'Seuil', intervals: 'Fractionné / VMA', hills: 'Côtes', long: 'Sortie longue',
  recovery: 'Récupération', technique: 'Technique', strength: 'Renforcement', race: 'Course / test', other: 'Autre',
};

/** La séance d’une fiche de bibliothèque : le contenu d’une séance, sans date, fuseau ni ordre. */
export const libraryWorkoutSchema = workoutInputSchema.omit({ localDate: true, timeZone: true, sortOrder: true });
export type LibraryWorkout = z.output<typeof libraryWorkoutSchema>;

export const createTemplateSchema = z
  .object({ category: z.enum(LIBRARY_CATEGORIES).default('other'), workout: libraryWorkoutSchema })
  .strict();
export const updateTemplateSchema = z
  .object({
    expectedRevision: z.number().int().min(1),
    category: z.enum(LIBRARY_CATEGORIES).optional(),
    workout: libraryWorkoutSchema.optional(),
    archive: z.boolean().optional(),
  })
  .strict();

/** Catégorie proposée pour un modèle rapide, d’après son identifiant. */
const PRESET_CATEGORY: Record<string, LibraryCategory> = {
  warmup: 'other', cooldown: 'recovery', endurance: 'endurance', 'short-intervals': 'intervals', 'long-intervals': 'intervals', sets: 'intervals',
  tempo: 'tempo', hills: 'hills', 'long-run': 'long', 'sweet-spot': 'threshold', sprints: 'intervals',
};

/** Séances de départ : les modèles rapides complets (hors échauffement et retour au calme seuls), avec leur sport principal. */
export function starterLibrary(): { category: LibraryCategory; workout: LibraryWorkout }[] {
  return PRESETS.filter((p) => p.id !== 'warmup' && p.id !== 'cooldown').map((p) => {
    const sport: Sport = (p.sports.find((s) => s !== 'triathlon' && s !== 'duathlon') ?? p.sports[0] ?? 'running') as Sport;
    const blocks: Block[] = p.blocks();
    return {
      category: PRESET_CATEGORY[p.id] ?? 'other',
      workout: { sport, title: p.label, instructions: null, durationSeconds: null, distanceM: null, intervals: blocks } as LibraryWorkout,
    };
  });
}


// ---------- Séance de groupe (lot G2, D-042) ----------

const uuid = z.string().uuid({ message: 'Identifiant invalide' });
/** Une base commune → un brouillon par élève choisi (1 à 60), à la même date locale. */
export const createGroupSessionSchema = z
  .object({
    teamId: uuid,
    localDate: z.string().refine(isLocalDate, { message: 'Date invalide' }),
    workout: libraryWorkoutSchema,
    athleteIds: z.array(uuid).min(1, { message: 'Choisis au moins un élève' }).max(60, { message: '60 élèves au plus' }),
  })
  .strict();
/** Publication explicite : les lignes choisies, chacune à la révision vue dans l’aperçu. */
export const publishGroupSessionSchema = z
  .object({
    items: z.array(z.object({ athleteId: uuid, workoutId: uuid, revision: z.number().int().min(1) }).strict())
      .min(1, { message: 'Choisis au moins une séance à publier' }).max(60),
  })
  .strict();

/** Modifier la base commune (D-046) : répercutée sur les séances encore identiques à l’ancienne base. */
export const updateGroupBaseSchema = z
  .object({ expectedRevision: z.number().int().min(1), workout: libraryWorkoutSchema })
  .strict();

/** JSON à clés triées : deux contenus égaux donnent le même texte, quel que soit l’ordre des clés. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/**
 * La séance d’un élève suit-elle encore la base ? Même sport, titre, consignes, blocs et date.
 * Toute adaptation (contenu ou date) la sort de la base : une modification de la base ne l’écrase jamais.
 */
export function followsBase(
  base: { sport: string; title: string; instructions?: string | null; intervals?: unknown },
  rev: { sport: string; title: string; instructions: string | null; intervals: unknown; localDate: string },
  groupDate: string,
): boolean {
  return rev.sport === base.sport && rev.title === base.title && (rev.instructions ?? '') === (base.instructions ?? '')
    && rev.localDate === groupDate && canonical(rev.intervals ?? []) === canonical(base.intervals ?? []);
}

export type GroupSessionRowState = 'draft' | 'adapted' | 'published' | 'changed';
export const GROUP_ROW_LABELS: Record<GroupSessionRowState, string> = {
  draft: 'Brouillon', adapted: 'Adaptée, pas publiée', published: 'Publiée', changed: 'Modifiée depuis la publication',
};
/** État d’une ligne : adaptée = brouillon qui ne suit plus la base commune. */
export function groupRowState(working: number, published: number | null, base = working === 1): GroupSessionRowState {
  if (published === null) return base ? 'draft' : 'adapted';
  return published === working ? 'published' : 'changed';
}
