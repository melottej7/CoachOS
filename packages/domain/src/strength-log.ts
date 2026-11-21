import { z } from 'zod';
import { followSequence } from './exercises';
import type { Block } from './structure';

/**
 * D-096 (M4) · Séries et charges réalisées. Le retour d’une séance de musculation porte, exercice par exercice,
 * ce que l’élève a vraiment fait (répétitions, charge, durée) ; le coach le compare au prévu et voit la progression.
 */

export interface StrengthSet { reps: number | null; kg: number | null; seconds: number | null }
export interface StrengthEntry { exerciseId: string | null; name: string; sets: StrengthSet[] }
/** Série prévue, avec sa place dans le mode « Suivre » (pour reprendre ce qui y a été noté). */
export interface PlannedSet extends StrengthSet { followIndex: number }
export interface PlannedEntry { key: string; exerciseId: string | null; name: string; sets: PlannedSet[] }

const kgSchema = z.number().min(0).max(500).multipleOf(0.5);
export const strengthSetSchema = z.object({
  reps: z.number().int().min(0, { message: '0 au moins' }).max(500, { message: '500 au plus' }).nullish().transform((v) => v ?? null),
  kg: kgSchema.nullish().transform((v) => v ?? null),
  seconds: z.number().int().min(1).max(3600).nullish().transform((v) => v ?? null),
}).strict();
export const strengthLogSchema = z.array(z.object({
  exerciseId: z.string().uuid().nullish().transform((v) => v ?? null),
  name: z.string().trim().min(1).max(80),
  sets: z.array(strengthSetSchema).min(1).max(30),
}).strict()).max(40, { message: '40 exercices au plus' }).default([]);

const keyOf = (id: string | null, name: string) => id ?? `nom:${name.trim().toLowerCase()}`;

/** Ce qui est prévu, exercice par exercice, dans l’ordre de première apparition ; une série par passage. */
export function strengthPlan(blocks: Block[]): PlannedEntry[] {
  const out = new Map<string, PlannedEntry>();
  for (const f of followSequence(blocks)) {
    const s = f.step;
    if (!s.exercise || s.phase === 'rest' || s.phase === 'recovery') continue;
    const key = keyOf(s.exercise.id, s.exercise.name);
    if (!out.has(key) && out.size >= 40) continue;
    const e = out.get(key) ?? { key, exerciseId: s.exercise.id, name: s.exercise.name, sets: [] };
    if (e.sets.length >= 30) continue;
    e.sets.push({
      followIndex: f.index,
      reps: s.measure.kind === 'reps' ? s.measure.reps : null,
      kg: s.intensity.kind === 'load' ? s.intensity.min : null,
      seconds: s.measure.kind === 'time' ? s.measure.seconds : null,
    });
    out.set(key, e);
  }
  return [...out.values()];
}

/** Le prévu, tel quel, comme réalisé (« Tout comme prévu »). */
export const asDone = (plan: PlannedEntry[]): StrengthEntry[] =>
  plan.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: e.sets.map(({ reps, kg, seconds }) => ({ reps, kg, seconds })) }));

const kgText = (n: number) => `${n.toLocaleString('fr-BE', { maximumFractionDigits: 1 })} kg`;
const secText = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}′${s % 60 ? String(s % 60).padStart(2, '0') : ''}` : `${s} s`);

/** « 10 × 16 kg » ; « 12 rép » sans charge ; « 30 s ». */
export function setText(s: StrengthSet): string {
  if (s.seconds !== null && s.reps === null) return `${secText(s.seconds)}${s.kg ? ` · ${kgText(s.kg)}` : ''}`;
  if (s.reps === null) return s.kg ? kgText(s.kg) : '—';
  return s.kg ? `${s.reps} × ${kgText(s.kg)}` : `${s.reps} rép`;
}

/** Comparaison d’une série au prévu : moins (répétitions, charge ou durée), autant, ou plus. */
export function compareSet(planned: StrengthSet | undefined, done: StrengthSet): 'less' | 'same' | 'more' {
  if (!planned) return 'more';
  const d = (a: number | null, b: number | null) => (a === null || b === null ? 0 : Math.sign(a - b));
  const parts = [d(done.reps, planned.reps), d(done.kg, planned.kg), d(done.seconds, planned.seconds)];
  if (done.reps === 0) return 'less';
  if (parts.some((x) => x < 0)) return 'less';
  return parts.some((x) => x > 0) ? 'more' : 'same';
}

/** Résumé d’un exercice réalisé, comparé au prévu : séries faites, séries en moins ou en plus. */
export function entryVerdict(planned: PlannedEntry | undefined, done: StrengthEntry): { less: number; more: number; missing: number } {
  const sets = done.sets.filter((s) => s.reps !== 0);
  const res = sets.map((s, i) => compareSet(planned?.sets[i], s));
  return { less: res.filter((x) => x === 'less').length, more: res.filter((x) => x === 'more').length, missing: Math.max(0, (planned?.sets.length ?? 0) - sets.length) };
}

// ---------- Progression des charges ----------

export interface LoadPoint { date: string; topKg: number | null; topReps: number | null; topSeconds: number | null; volumeKg: number; sets: number }
export interface LoadSeries { key: string; exerciseId: string | null; name: string; points: LoadPoint[] }

/**
 * Progression par exercice, séance après séance (ordre chronologique). La meilleure série est la plus lourde,
 * à égalité celle qui a le plus de répétitions ; sans charge, celle qui a le plus de répétitions ou dure le plus.
 */
export function loadProgress(sessions: { date: string; log: StrengthEntry[] }[]): LoadSeries[] {
  const out = new Map<string, LoadSeries>();
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of s.log) {
      const done = e.sets.filter((x) => x.reps !== 0);
      if (!done.length) continue;
      const key = keyOf(e.exerciseId, e.name);
      const best = [...done].sort((a, b) => (b.kg ?? 0) - (a.kg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0) || (b.seconds ?? 0) - (a.seconds ?? 0))[0]!;
      const series = out.get(key) ?? { key, exerciseId: e.exerciseId, name: e.name, points: [] };
      series.name = e.name;
      series.points.push({
        date: s.date, topKg: best.kg, topReps: best.reps, topSeconds: best.seconds, sets: done.length,
        volumeKg: Math.round(done.reduce((n, x) => n + (x.reps ?? 0) * (x.kg ?? 0), 0) * 10) / 10,
      });
      out.set(key, series);
    }
  }
  return [...out.values()].sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name, 'fr'));
}

/** Évolution lisible entre la première et la dernière séance : « 12 kg → 16 kg (+4 kg) », « 8 → 12 répétitions ». */
export function progressText(series: LoadSeries): string | null {
  const first = series.points[0], last = series.points.at(-1);
  if (!first || !last || series.points.length < 2) return null;
  if (first.topKg !== null && last.topKg !== null) {
    const dk = last.topKg - first.topKg;
    return `${kgText(first.topKg)} → ${kgText(last.topKg)}${dk ? ` (${dk > 0 ? '+' : '−'}${kgText(Math.abs(dk))})` : ''}`;
  }
  if (first.topReps !== null && last.topReps !== null) return `${first.topReps} → ${last.topReps} répétitions`;
  if (first.topSeconds !== null && last.topSeconds !== null) return `${secText(first.topSeconds)} → ${secText(last.topSeconds)}`;
  return null;
}

/** Le prévu, corrigé par ce que l’élève a noté pendant le mode « Suivre » (index d’étape → répétitions et charge). */
export function applyFollowLog(plan: PlannedEntry[], log: Record<number, { reps: number | null; kg: number | null }>): StrengthEntry[] {
  return plan.map((e) => ({
    exerciseId: e.exerciseId, name: e.name,
    sets: e.sets.map((s) => {
      const n = log[s.followIndex];
      return n ? { reps: n.reps, kg: n.kg, seconds: s.seconds } : { reps: s.reps, kg: s.kg, seconds: s.seconds };
    }),
  }));
}
