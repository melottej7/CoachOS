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

export const signInSchema = z.object({ email, password: z.string().min(1, { message: 'Saisir le mot de passe' }).max(PASSWORD_MAX) });
export const signUpSchema = z.object({ displayName, email, password: passwordSchema });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ password: passwordSchema });

/** Création du compte athlète depuis le lien d’invitation (le lien prouve la possession de l’adresse). */
export const inviteRegisterSchema = z
  .object({ token: z.string().min(20).max(200), displayName, email, password: passwordSchema })
  .strict();
