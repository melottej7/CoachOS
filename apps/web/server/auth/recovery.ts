/**
 * Bilan produit (fluidité) · « Mot de passe oublié » sur iPhone. L’application installée sur l’écran d’accueil ne partage
 * pas ses cookies avec Safari : le lien PKCE de l’e-mail, ouvert dans Safari, n’y trouvait pas son secret et échouait.
 * Deux voies qui marchent partout : le code à 6 chiffres recopié dans l’app qui a fait la demande, ou le lien
 * `/auth/confirm?token_hash=…`, vérifié par le serveur sans secret côté navigateur.
 */
export const RECOVERY_EMAIL_COOKIE = 'coachos_recovery_email';

/** Code reçu par e-mail : 6 chiffres, espaces tolérés (« 123 456 »). */
export function normalizeCode(raw: string): string | null {
  const digits = raw.replace(/\s+/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

export type ConfirmType = 'recovery' | 'signup' | 'email' | 'invite';
export const CONFIRM_TYPES: readonly ConfirmType[] = ['recovery', 'signup', 'email', 'invite'];
