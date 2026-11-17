/** Sports du catalogue (table public.sports). */
export const SPORTS = ['running', 'trail', 'cycling', 'swimming', 'triathlon', 'duathlon'] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  running: 'Course à pied',
  trail: 'Trail',
  cycling: 'Cyclisme',
  swimming: 'Natation',
  triathlon: 'Triathlon',
  duathlon: 'Duathlon',
};
