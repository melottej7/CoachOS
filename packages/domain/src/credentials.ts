import { z } from 'zod';
import { normalizeEmail } from './workspace';

/** Mot de passe (D-020) : 8 caractères minimum, 72 au plus (limite bcrypt de Supabase Auth). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const email = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email({ message: 'Adresse e-mail invalide' }).max(254));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, { message: `${PASSWORD_MIN} caractères minimum` })
  .max(PASSWORD_MAX, { message: `${PASSWORD_MAX} caractères au plus` });

const displayName = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, { message: 'Saisir ton nom' }).max(100, { message: '100 caractères au plus' }));

/** D-153 : prénom et nom demandés séparément à l’inscription ; espaces superflus retirés. */
const namePart = (missing: string) => z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, { message: missing }).max(50, { message: '50 caractères au plus' }));
const firstName = namePart('Saisir ton prénom');
const lastName = namePart('Saisir ton nom');

/** D-153 : le nom affiché est « Prénom Nom » ; le prénom reste le premier mot, comme partout dans l’application. */
export const fullName = (first: string, last: string) => `${first.trim()} ${last.trim()}`.trim();

export const signInSchema = z.object({ email, password: z.string().min(1, { message: 'Saisir le mot de passe' }).max(PASSWORD_MAX) });
export const signUpSchema = z
  .object({ firstName, lastName, email, password: passwordSchema })
  .transform(({ firstName: f, lastName: l, ...rest }) => ({ ...rest, displayName: fullName(f, l) }));
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ password: passwordSchema });

/**
 * Création du compte athlète depuis le lien d’invitation (le lien prouve la possession de l’adresse).
 * D-153 : prénom et nom séparés ; `displayName` seul reste accepté pour une page ouverte avant la mise à jour.
 */
export const inviteRegisterSchema = z
  .preprocess(
    // Sans `displayName`, prénom et nom sont obligatoires : absents, ils valent '' et reçoivent leur message.
    (raw) => (raw && typeof raw === 'object' && !('displayName' in raw) ? { firstName: '', lastName: '', ...raw } : raw),
    z
      .object({
        token: z.string().min(20).max(200),
        firstName: firstName.optional(),
        lastName: lastName.optional(),
        displayName: displayName.optional(),
        email,
        password: passwordSchema,
      })
      .strict(),
  )
  .transform(({ firstName: f, lastName: l, displayName: d, ...rest }) => ({ ...rest, displayName: f && l ? fullName(f, l) : (d ?? '') }));
