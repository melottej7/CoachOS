/** Sports du catalogue (table public.sports). */
export const SPORTS = ['running', 'trail', 'cycling', 'swimming', 'triathlon', 'duathlon', 'strength'] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  running: 'Course à pied',
  trail: 'Trail',
  cycling: 'Cyclisme',
  swimming: 'Natation',
  triathlon: 'Triathlon',
  duathlon: 'Duathlon',
  strength: 'Musculation',
};

/** D-096 : sports d’endurance et musculation, activables séparément dans l’espace du coach. */
export const ENDURANCE_SPORTS: readonly Sport[] = ['running', 'trail', 'cycling', 'swimming', 'triathlon', 'duathlon'];
export const isStrength = (s: Sport | null | undefined) => s === 'strength';

/**
 * D-102 (M5) · Modules de l’espace, d’après les sports encadrés cochés par le coach (profil de l’espace) :
 * endurance, musculation, ou les deux. Rien de coché = les deux (aucune restriction).
 */
export interface Modules { endurance: boolean; strength: boolean }
export function modulesOf(sports: readonly Sport[] | null | undefined): Modules {
  if (!sports?.length) return { endurance: true, strength: true };
  return { endurance: sports.some((s) => s !== 'strength'), strength: sports.includes('strength') };
}
/** Sports proposés à la création d’une séance : ceux du module actif ; la valeur en cours reste toujours proposée. */
export function sportsFor(m: Modules, current?: Sport | null): Sport[] {
  const list = SPORTS.filter((s) => (s === 'strength' ? m.strength : m.endurance));
  return current && !list.includes(current) ? [...list, current] : list;
}
