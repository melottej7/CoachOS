import { followExercises, followSequence, type FollowExercise, type FollowStep } from './exercises';
import type { Block } from './structure';
import type { PlannedEntry, StrengthEntry, StrengthSet } from './strength-log';

/**
 * D-182 · À la salle, les machines ne se libèrent pas dans l’ordre du programme. Pendant « Suivre la séance »,
 * l’élève peut commencer par un autre exercice, en remplacer un (machine prise) ou en ajouter un qui n’était pas prévu.
 * Tout est gardé sur le téléphone puis repris dans son retour, pour que le coach voie ce qui a vraiment été fait.
 */

export interface FollowSwap { name: string; exerciseId: string | null; starterKey: string | null; /** Nom d’origine, tel qu’écrit par le coach. */ from: string }
/** Remplacements, par exercice d’une partie : clé `rang de la partie|nom d’origine en minuscules`. */
export type FollowSwaps = Record<string, FollowSwap>;
export const swapKey = (part: number, name: string) => `${part}|${name.trim().toLowerCase()}`;

export interface FollowExtra { name: string; exerciseId: string | null; starterKey: string | null; sets: number; reps: number | null; kg: number | null }

/** Rang de la partie (exercice, circuit, cardio) qui contient l’étape. */
export function partOf(parts: FollowExercise[], index: number): number {
  return parts.findIndex((p) => index >= p.first && index <= p.last);
}

/**
 * Prochaine partie à faire après `from` : la suivante non faite dans l’ordre du programme, sinon la première restée
 * en arrière (celle qu’on a laissée parce que la machine était prise). `null` : tout est fait ou passé.
 */
export function nextOpenPart(count: number, closed: ReadonlySet<number>, from: number): number | null {
  for (let k = from + 1; k < count; k++) if (!closed.has(k)) return k;
  for (let k = 0; k < Math.min(from, count); k++) if (!closed.has(k)) return k;
  return null;
}

/** Exercices remplaçables d’une partie (noms d’origine, sans le cardio en paliers). */
export function swappableNames(seq: FollowStep[], part: FollowExercise): string[] {
  const names = seq.slice(part.first, part.last + 1)
    .filter((f) => f.step.exercise && !f.step.cardio && f.step.phase !== 'rest' && f.step.phase !== 'recovery')
    .map((f) => f.step.exercise!.name);
  return [...new Set(names)];
}

/** Le déroulé avec les remplacements de l’élève (nom et fiche de l’exercice fait à la place). */
export function withSwaps(seq: FollowStep[], parts: FollowExercise[], swaps: FollowSwaps): FollowStep[] {
  if (!Object.keys(swaps).length) return seq;
  return seq.map((f) => {
    const ex = f.step.exercise;
    if (!ex || f.step.cardio) return f;
    const sw = swaps[swapKey(partOf(parts, f.index), ex.name)];
    return sw ? { ...f, step: { ...f.step, exercise: { id: sw.exerciseId, name: sw.name } } } : f;
  });
}

export interface FollowChanges { skippedParts: number[]; swaps: FollowSwaps; extras: FollowExtra[] }
export const NO_CHANGES: FollowChanges = { skippedParts: [], swaps: {}, extras: [] };

/**
 * Le journal de musculation proposé au retour, corrigé par ce qui a changé pendant la séance : séries d’un exercice
 * passé à 0 (non faites), séries d’un exercice remplacé reportées sur le remplaçant, exercices ajoutés à la fin.
 */
export function adjustForChanges(blocks: Block[], plan: PlannedEntry[], done: StrengthEntry[], changes: FollowChanges): StrengthEntry[] {
  const { skippedParts, swaps, extras } = changes;
  if (!skippedParts.length && !Object.keys(swaps).length && !extras.length) return done;
  const seq = followSequence(blocks);
  const parts = followExercises(seq);
  const skipped = new Set(skippedParts);
  const out: StrengthEntry[] = [];
  plan.forEach((p, n) => {
    const d = done[n];
    if (!d) return;
    const kept: StrengthSet[] = [];
    const moved = new Map<string, StrengthEntry>();
    p.sets.forEach((ps, j) => {
      const set = d.sets[j] ?? { reps: ps.reps, kg: ps.kg, seconds: ps.seconds };
      const k = partOf(parts, ps.followIndex);
      const sw = swaps[swapKey(k, p.name)];
      if (sw) {
        const e = moved.get(sw.name) ?? { exerciseId: sw.exerciseId, name: sw.name, sets: [] };
        e.sets.push(set);
        moved.set(sw.name, e);
      } else if (skipped.has(k)) kept.push({ reps: 0, kg: null, seconds: set.seconds });
      else kept.push(set);
    });
    if (kept.length) out.push({ ...d, sets: kept });
    out.push(...moved.values());
  });
  for (const x of extras) {
    if (out.length >= 40) break;
    const n = Math.max(1, Math.min(30, x.sets));
    out.push({ exerciseId: x.exerciseId, name: x.name.slice(0, 80), sets: Array.from({ length: n }, () => ({ reps: x.reps, kg: x.kg, seconds: null })) });
  }
  return out;
}

/** Phrase pour le coach, proposée dans le commentaire du retour. */
export function describeFollowChanges(parts: FollowExercise[], changes: FollowChanges): string | null {
  const swaps = Object.values(changes.swaps).map((sw) => `${sw.from} → ${sw.name}`);
  const skipped = changes.skippedParts.map((k) => parts[k]?.name).filter(Boolean);
  const extras = changes.extras.map((x) => `${x.name} (${x.sets} × ${x.reps ?? '?'}${x.kg ? ` à ${String(x.kg).replace('.', ',')} kg` : ''})`);
  const bits = [
    swaps.length ? `remplacé : ${swaps.join(', ')}` : null,
    skipped.length ? `pas fait : ${skipped.join(', ')}` : null,
    extras.length ? `en plus : ${extras.join(', ')}` : null,
  ].filter(Boolean);
  return bits.length ? `Changements à la salle — ${bits.join(' ; ')}.` : null;
}
