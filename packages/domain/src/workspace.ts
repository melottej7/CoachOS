import { z } from 'zod';
import { isTimeZone } from './dates';

const timeZone = z.string().max(80).refine(isTimeZone, { message: 'Fuseau horaire inconnu' });
const trimmed = (min: number, max: number, empty: string) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(min, { message: empty }).max(max, { message: `${max} caractères au plus` }));

/** POST /workspaces (C02-03, C02-04). */
export const createWorkspaceSchema = z
  .object({ name: trimmed(1, 120, 'Saisir le nom de l’espace'), timeZone })
  .strict();

/** POST /workspaces/{wid}/athletes (C03-01). Fiche créée à l’état « invité ». */
export const createAthleteSchema = z
  .object({ displayName: trimmed(1, 100, 'Saisir le nom de l’athlète'), timeZone })
  .strict();

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * POST /workspaces/{wid}/athletes/{aid}/invite (C03-02). L’adresse n’est jamais stockée en clair.
 * D-149 : `delivery` « email » (par défaut) envoie le lien ; « link » le rend au coach, qui l’envoie lui-même (SMS, messagerie).
 */
export const INVITE_DELIVERIES = ['email', 'link'] as const;
export const inviteSchema = z
  .object({
    email: z
      .string()
      .transform(normalizeEmail)
      .pipe(z.email({ message: 'Adresse e-mail invalide' }).max(254)),
    delivery: z.enum(INVITE_DELIVERIES).default('email'),
  })
  .strict();

/** POST /invitations/accept (C03-03). */
export const acceptInvitationSchema = z.object({ token: z.string().min(20).max(200) }).strict();

/** Durée de validité d’un lien d’invitation (PRD : 7 jours). */
export const INVITATION_TTL_DAYS = 7;
