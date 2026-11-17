import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Client Supabase lié aux cookies de la requête (flux PKCE). Dans un composant serveur,
 * l’écriture de cookie est impossible : le proxy rafraîchit la session avant le rendu.
 */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Composant serveur : lecture seule, le proxy s’en charge.
        }
      },
    },
  });
}

export { safeNext } from '@coachos/domain';
