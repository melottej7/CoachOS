import { cookies } from 'next/headers';

/**
 * Mode simple du coach (D-169) : l’essentiel seulement (brief, retours, élèves, calendrier, bibliothèque) ; tâches manuelles,
 * rendez-vous, filtres, méthode et notifications sont masqués, jamais supprimés. Mémorisé sur l’appareil, comme le thème.
 */
export const SIMPLE_COOKIE = 'coachos_mode';

export async function isSimpleMode(): Promise<boolean> {
  return (await cookies()).get(SIMPLE_COOKIE)?.value === 'simple';
}
