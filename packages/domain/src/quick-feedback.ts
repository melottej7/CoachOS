import type { ResultState } from './feedback';
import type { Block, Step } from './structure';

// CE-C-03 (D-039) : retour rapide depuis Aujourd’hui et intention de ressenti portée par la séance.

export const INTENTS = ['easy', 'moderate', 'hard'] as const;
export type Intent = (typeof INTENTS)[number];
export const INTENT_LABELS: Record<Intent, string> = { easy: 'facile', moderate: 'modérée', hard: 'difficile' };

/** Ressenti d’effort en 5 choix, enregistré sur l’échelle d’effort (RPE 1 à 10). */
export const QUICK_EFFORTS = [
  { rpe: 2, label: 'Très facile' },
  { rpe: 4, label: 'Facile' },
  { rpe: 6, label: 'Moyen' },
  { rpe: 8, label: 'Dur' },
  { rpe: 10, label: 'Très dur' },
] as const;

/** Zone 1–2 ou effort ≤ 4 : facile ; zone 3–4 ou effort 5–6 : modérée ; au-delà : difficile. */
export function intentOfRpe(rpe: number): Intent {
  return rpe <= 4 ? 'easy' : rpe <= 6 ? 'moderate' : 'hard';
}
function intentOfStep(s: Step): Intent | null {
  const i = s.intensity;
  if (i.kind === 'zone') return i.zone <= 2 ? 'easy' : i.zone <= 4 ? 'moderate' : 'hard';
  if (i.kind === 'rpe') return intentOfRpe(i.max ?? i.min);
  return null;
}
const RANK: Record<Intent, number> = { easy: 0, moderate: 1, hard: 2 };

/**
 * Intention de la séance : l’intensité la plus haute des blocs de travail (zone ou effort),
 * sinon de tous les blocs. Null si la séance ne donne ni zone ni effort.
 */
export function sessionIntent(blocks: Block[]): Intent | null {
  const steps: Step[] = [];
  const walk = (bs: Block[]) => bs.forEach((b) => (b.type === 'repeat' ? walk(b.steps) : steps.push(b)));
  walk(blocks);
  const pick = (ss: Step[]) => ss.map(intentOfStep).filter((x): x is Intent => x !== null).sort((a, b) => RANK[b] - RANK[a])[0] ?? null;
  return pick(steps.filter((s) => s.phase === 'work')) ?? pick(steps);
}

/** Écart entre ressenti et intention : -1 plus facile, 0 conforme, 1 plus dur que prévu. */
export function effortGap(intent: Intent | null, rpe: number | null): -1 | 0 | 1 | null {
  if (!intent || rpe === null) return null;
  const d = RANK[intentOfRpe(rpe)] - RANK[intent];
  return d < 0 ? -1 : d > 0 ? 1 : 0;
}

/** Corps d’un premier retour rapide : l’état et, s’il y a lieu, le ressenti ; le reste vide (complétable ensuite). */
export function quickFeedbackBody(publishedRevision: number, state: ResultState, rpe: number | null) {
  return {
    publishedRevision, expectedRevision: null, state, durationSeconds: null, distanceM: null, rpe: state === 'missed' ? null : rpe,
    comment: '', overallFeeling: null, difficulties: [], changes: [], actualSport: null, repeatsDone: [],
  };
}
