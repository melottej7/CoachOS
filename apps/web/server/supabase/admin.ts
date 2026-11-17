import { createClient } from '@supabase/supabase-js';
import type { EnsureAuthUsers } from '../db/seed';

/** Client d’administration Supabase (clé service). Serveur et scripts uniquement, jamais exposé au navigateur. */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (npm run supabase:env)');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Crée les comptes fictifs dans Supabase Auth avec des UUID fixes ; ignore ceux qui existent déjà. */
export const supabaseAuthUsers: EnsureAuthUsers = async (people) => {
  const admin = supabaseAdmin();
  for (const p of people) {
    const existing = await admin.auth.admin.getUserById(p.id);
    if (existing.data.user) continue;
    const { error } = await admin.auth.admin.createUser({
      id: p.id,
      email: p.email,
      email_confirm: true,
      user_metadata: { display_name: p.name },
    });
    if (error) throw new Error(`Création du compte fictif impossible (${p.email}) : ${error.message}`);
  }
};
