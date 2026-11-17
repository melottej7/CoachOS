import { createClient } from '@supabase/supabase-js';
import type { EnsureAuthUsers } from '../db/seed';
import { DEMO_PASSWORD } from '../db/fixtures';

/** Client d’administration Supabase (clé service). Serveur et scripts uniquement, jamais exposé au navigateur. */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (npm run supabase:env)');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Crée les comptes fictifs dans Supabase Auth (UUID fixes, mot de passe de démo) ; remet le mot de passe des existants. */
export const supabaseAuthUsers: EnsureAuthUsers = async (people) => {
  const admin = supabaseAdmin();
  for (const p of people) {
    const existing = await admin.auth.admin.getUserById(p.id);
    if (existing.data.user) {
      const { error } = await admin.auth.admin.updateUserById(p.id, { password: DEMO_PASSWORD });
      if (error) throw new Error(`Mise à jour du compte fictif impossible (${p.email}) : ${error.message}`);
      continue;
    }
    const { error } = await admin.auth.admin.createUser({
      id: p.id,
      email: p.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: p.name },
    });
    if (error) throw new Error(`Création du compte fictif impossible (${p.email}) : ${error.message}`);
  }
};

/** Création d’un compte par adresse et mot de passe, adresse marquée vérifiée (invitation reçue à cette adresse). */
export const createConfirmedUser: import('../commands/invitations').CreateAuthUser = async ({ email, password, displayName }) => {
  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) {
    if (error.code === 'email_exists' || error.code === 'user_already_exists') return { exists: true };
    throw error;
  }
  return { userId: data.user.id };
};
