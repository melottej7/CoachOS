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
