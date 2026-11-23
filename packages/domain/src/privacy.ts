import { z } from 'zod';

/**
 * D-115 · Données personnelles. Demandes de droits du contrat (privacy_requests.kind) :
 * accès et portabilité donnent un export immédiat ; effacement et rectification ouvrent une demande
 * traitée par le responsable de l’espace (le coach propriétaire) sous 30 jours.
 */
export const PRIVACY_REQUEST_KINDS = ['access', 'portability', 'erase', 'correct'] as const;
export type PrivacyRequestKind = (typeof PRIVACY_REQUEST_KINDS)[number];

export const PRIVACY_REQUEST_STATES = ['open', 'verifying', 'processing', 'completed', 'denied'] as const;
export type PrivacyRequestState = (typeof PRIVACY_REQUEST_STATES)[number];

export const PRIVACY_REQUEST_KIND_LABELS: Record<PrivacyRequestKind, string> = {
  access: 'Accès à mes données',
  portability: 'Export de mes données',
  erase: 'Effacement de mes données',
  correct: 'Rectification de mes données',
};

export const PRIVACY_REQUEST_STATE_LABELS: Record<PrivacyRequestState, string> = {
  open: 'Reçue',
  verifying: 'Identité en cours de vérification',
  processing: 'En cours de traitement',
  completed: 'Traitée',
  denied: 'Refusée',
};

/** Délai de traitement d’une demande (RGPD art. 12 : un mois). */
export const PRIVACY_REQUEST_DAYS = 30;

export const openPrivacyRequestSchema = z
  .object({ kind: z.enum(PRIVACY_REQUEST_KINDS, { message: 'Type de demande inconnu' }) })
  .strict();
