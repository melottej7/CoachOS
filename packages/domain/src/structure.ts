import { z } from 'zod';
import { SPORTS, SPORT_LABELS, type Sport } from './sports';

/**
 * Séance structurée (D-023) : une suite de blocs. Un bloc est soit une étape (durée, distance ou libre,
 * avec une intensité), soit une répétition d’étapes (« 5 × »), imbricable sur un niveau (séries).
 * Stockée dans workout_revisions.intervals (jsonb), sans migration.
 */

export const PHASES = ['warmup', 'work', 'recovery', 'cooldown', 'rest', 'other'] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABELS: Record<Phase, string> = {
  warmup: 'Échauffement', work: 'Effort', recovery: 'Récupération', cooldown: 'Retour au calme', rest: 'Repos', other: 'Autre',
};

/** Échelle de référence à 7 zones du fondateur (D-029, reprise de Foulée). */
export const ZONES = [1, 2, 3, 4, 5, 6, 7] as const;
export type Zone = (typeof ZONES)[number];
export const ZONE_NAMES: Record<Zone, string> = {
  1: 'récupération', 2: 'endurance fondamentale', 3: 'tempo', 4: 'seuil', 5: 'VMA longue', 6: 'VMA moyenne', 7: 'VMA courte',
};
export const ZONE_LABELS: Record<Zone, string> = Object.fromEntries(
  ZONES.map((z) => [z, `Z${z} (${ZONE_NAMES[z]})`]),
) as Record<Zone, string>;

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const measureSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('time'), seconds: int(1, 86400) }).strict(),
  z.object({ kind: z.literal('distance'), meters: int(1, 1_000_000) }).strict(),
  z.object({ kind: z.literal('open') }).strict(),
]);
export type Measure = z.output<typeof measureSchema>;

const range = <S extends z.ZodNumber>(n: S) =>
  z.object({ min: n, max: n.nullish().transform((v) => v ?? null) }).strict();

export const intensitySchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }).strict(),
    z.object({ kind: z.literal('zone'), zone: int(1, 7) }).strict(),
    z.object({ kind: z.literal('pace'), unit: z.enum(['per_km', 'per_100m']), ...range(int(30, 1800)).shape }).strict(),
    z.object({ kind: z.literal('power'), unit: z.enum(['w', 'pct_ftp']), ...range(int(1, 2500)).shape }).strict(),
    z.object({ kind: z.literal('hr'), unit: z.enum(['bpm', 'pct_max']), ...range(int(30, 250)).shape }).strict(),
    z.object({ kind: z.literal('rpe'), ...range(int(1, 10)).shape }).strict(),
  ])
  .refine((i) => !('max' in i) || i.max === null || i.max >= i.min, { message: 'La valeur haute doit dépasser la valeur basse' });
export type Intensity = z.output<typeof intensitySchema>;

export const stepSchema = z
  .object({
    type: z.literal('step'),
    phase: z.enum(PHASES),
    sport: z.enum(SPORTS).nullish().transform((v) => v ?? null),
    measure: measureSchema,
    intensity: intensitySchema.default({ kind: 'none' }),
    cadence: z.object({ min: int(20, 250), max: int(20, 250).nullish().transform((v) => v ?? null) }).strict().nullish().transform((v) => v ?? null),
    note: z
      .string()
      .max(200, { message: '200 caractères au plus' })
      .nullish()
      .transform((v) => (v?.trim() ? v.trim() : null)),
  })
  .strict();
export type Step = z.output<typeof stepSchema>;

export interface RepeatBlock {
  type: 'repeat';
  times: number;
  steps: Block[];
}
export type Block = Step | RepeatBlock;

/** Répétition : 2 à 50 fois ; une répétition peut en contenir une autre (séries), pas davantage. */
const repeatInner = z
  .object({ type: z.literal('repeat'), times: int(2, 50), steps: z.array(stepSchema).min(1).max(20) })
  .strict();
const repeatOuter = z
  .object({ type: z.literal('repeat'), times: int(2, 50), steps: z.array(z.union([stepSchema, repeatInner])).min(1).max(20) })
  .strict();

export const structureSchema = z
  .array(z.union([stepSchema, repeatOuter]))
  .max(30, { message: '30 blocs au plus' })
  .default([])
  .refine((blocks) => countSteps(blocks as Block[]) <= 80, { message: '80 étapes au plus en tout' });

export function countSteps(blocks: Block[]): number {
  return blocks.reduce((n, b) => n + (b.type === 'step' ? 1 : countSteps(b.steps)), 0);
}

// ---------- Totaux ----------

export interface Totals {
  seconds: number;
  /** Distance prescrite (blocs en distance). */
  meters: number;
  /** Distance prescrite + distance estimée des blocs en durée dont la vitesse est connue (allure, ou zone + VMA). */
  totalMeters: number;
  /** Vrai si une partie du temps est estimée (distance + allure ou zone). */
  estimated: boolean;
  /** Vrai si une partie du temps est inconnue (bloc libre, distance sans vitesse connue). */
  unknownTime: boolean;
  /** Vrai si une partie de la distance vient d’une estimation. */
  distanceEstimated: boolean;
  /** Vrai si une partie de la distance est inconnue (durée sans vitesse connue, bloc libre). */
  unknownDistance: boolean;
}

/** Repères de l’athlète servant aux estimations (CE-B-03, D-029). */
export interface References {
  /** Vitesse maximale aérobie, km/h (course à pied). */
  vmaKmh: number | null;
}

/** Plages cibles de l’échelle à 7 zones, en % de VMA (choix du fondateur, D-029). */
export const ZONE_TARGET_PCT: Record<Zone, readonly [number, number]> = {
  1: [60, 65], 2: [65, 70], 3: [72, 78], 4: [85, 90], 5: [90, 95], 6: [95, 100], 7: [100, 110],
};
const VMA_SPORTS: ReadonlySet<Sport> = new Set(['running', 'trail']);

/** Allure cible d’une zone en secondes par km : [la plus lente, la plus rapide]. */
export function zonePace(zone: Zone, vmaKmh: number): [number, number] {
  const [lo, hi] = ZONE_TARGET_PCT[zone];
  return [Math.round(3600 / ((vmaKmh * lo) / 100)), Math.round(3600 / ((vmaKmh * hi) / 100))];
}

/** Les zones se traduisent en allure pour la course seulement (VMA). */
export function usesVma(sport: Sport | null | undefined): boolean {
  return Boolean(sport && VMA_SPORTS.has(sport));
}

function paceSeconds(i: Intensity): { perMeter: number } | null {
  if (i.kind !== 'pace') return null;
  const avg = i.max === null ? i.min : (i.min + i.max) / 2;
  return { perMeter: i.unit === 'per_km' ? avg / 1000 : avg / 100 };
}

/** Vitesse en m/s d’une étape : allure donnée, ou zone convertie avec la VMA. */
function speedOf(step: Step, sessionSport: Sport | undefined, refs: References | undefined): number | null {
  const p = paceSeconds(step.intensity);
  if (p) return 1 / p.perMeter;
  const sport = step.sport ?? sessionSport;
  if (step.intensity.kind === 'zone' && refs?.vmaKmh && usesVma(sport)) {
    const [lo, hi] = ZONE_TARGET_PCT[step.intensity.zone as Zone];
    return (refs.vmaKmh * ((lo + hi) / 2)) / 100 / 3.6;
  }
  return null;
}

/** Estimation d’une étape : allure cible (s/km, course), durée ou distance déduite. */
export function stepEstimate(step: Step, sessionSport?: Sport, refs?: References): { pace: [number, number] | null; seconds: number | null; meters: number | null } {
  const sport = step.sport ?? sessionSport;
  let pace: [number, number] | null = null;
  if (step.intensity.kind === 'pace' && step.intensity.unit === 'per_km') pace = [step.intensity.min, step.intensity.max ?? step.intensity.min];
  else if (step.intensity.kind === 'zone' && refs?.vmaKmh && usesVma(sport)) pace = zonePace(step.intensity.zone as Zone, refs.vmaKmh);
  const v = speedOf(step, sessionSport, refs);
  return {
    pace,
    seconds: v && step.measure.kind === 'distance' ? Math.round(step.measure.meters / v) : null,
    meters: v && step.measure.kind === 'time' ? Math.round((step.measure.seconds * v) / 10) * 10 : null,
  };
}

/**
 * Durée et distance totales d’une structure, répétitions comprises.
 * Sans repères, seules les allures données servent à estimer ; avec la VMA, les zones aussi (course).
 */
export function structureTotals(blocks: Block[], opts: { sport?: Sport; refs?: References } = {}): Totals {
  const t: Totals = { seconds: 0, meters: 0, totalMeters: 0, estimated: false, unknownTime: false, distanceEstimated: false, unknownDistance: false };
  let estMeters = 0;
  const add = (b: Block, factor: number) => {
    if (b.type === 'repeat') {
      for (const s of b.steps) add(s, factor * b.times);
      return;
    }
    const v = speedOf(b, opts.sport, opts.refs);
    if (b.measure.kind === 'time') {
      t.seconds += b.measure.seconds * factor;
      // Repos sans cible : à l’arrêt, aucune distance.
      if (b.phase === 'rest' && b.intensity.kind === 'none') return;
      if (v) {
        estMeters += b.measure.seconds * v * factor;
        t.distanceEstimated = true;
      } else t.unknownDistance = true;
    } else if (b.measure.kind === 'distance') {
      t.meters += b.measure.meters * factor;
      if (v) {
        t.seconds += Math.round(b.measure.meters / v) * factor;
        t.estimated = true;
      } else t.unknownTime = true;
    } else {
      t.unknownTime = true;
      t.unknownDistance = true;
    }
  };
  for (const b of blocks) add(b, 1);
  t.seconds = Math.round(t.seconds);
  t.totalMeters = t.meters + Math.round(estMeters / 10) * 10;
  return t;
}

// ---------- Texte lisible ----------

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m && s) return `${m} min ${s} s`;
  if (m) return `${m} min`;
  return `${s} s`;
}

export function formatMeters(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 2 })} km`;
}

const pace = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const rng = (min: number, max: number | null, f: (n: number) => string = String) => (max === null || max === min ? f(min) : `${f(min)} à ${f(max)}`);

export function describeMeasure(m: Measure): string {
  if (m.kind === 'time') return formatClock(m.seconds);
  if (m.kind === 'distance') return formatMeters(m.meters);
  return 'Libre';
}

export function describeIntensity(i: Intensity): string | null {
  switch (i.kind) {
    case 'none': return null;
    case 'zone': return ZONE_LABELS[i.zone as Zone];
    case 'pace': return `${rng(i.min, i.max, pace)} ${i.unit === 'per_km' ? '/km' : '/100 m'}`;
    case 'power': return i.unit === 'w' ? `${rng(i.min, i.max)} W` : `${rng(i.min, i.max)} % FTP`;
    case 'hr': return i.unit === 'bpm' ? `${rng(i.min, i.max)} bpm` : `${rng(i.min, i.max)} % FC max`;
    case 'rpe': return `Effort ${rng(i.min, i.max)}/10`;
  }
}

export function describeStep(s: Step, sessionSport?: Sport): string {
  const parts = [describeMeasure(s.measure)];
  const intensity = describeIntensity(s.intensity);
  if (intensity) parts.push(intensity);
  if (s.cadence) parts.push(`cadence ${rng(s.cadence.min, s.cadence.max)}`);
  const sport = s.sport && s.sport !== sessionSport ? `${SPORT_LABELS[s.sport]} · ` : '';
  return `${sport}${PHASE_LABELS[s.phase]} · ${parts.join(' · ')}${s.note ? ` (${s.note})` : ''}`;
}

/** Une ligne par bloc, lisible par l’athlète : « 5 × (400 m · Z5 / 200 m · Z1) ». */
export function describeBlock(b: Block, sessionSport?: Sport): string {
  if (b.type === 'step') return describeStep(b, sessionSport);
  const inner = b.steps.map((s) => (s.type === 'step' ? `${describeMeasure(s.measure)}${describeIntensity(s.intensity) ? ` · ${describeIntensity(s.intensity)}` : ''}` : describeBlock(s, sessionSport)));
  return `${b.times} × (${inner.join(' / ')})`;
}

/** Total lisible : « ≈ 52 min · 8,4 km », « au moins 49 min » si une partie dépend de l’athlète. */
export function describeTotals(t: Totals): string {
  const parts: string[] = [];
  if (t.seconds) parts.push(`${t.unknownTime ? 'au moins ' : t.estimated ? 'environ ' : ''}${formatClock(t.seconds)}`);
  if (t.totalMeters) parts.push(`${t.unknownDistance ? 'au moins ' : t.distanceEstimated ? 'environ ' : ''}${formatKm(t.totalMeters)}`);
  return parts.length ? parts.join(' · ') : 'durée libre';
}

/** Distance arrondie pour un total : 6,2 km, 800 m. */
export function formatKm(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 1 })} km`;
}

/** Allure « 5:43 /km ». */
export function formatPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`;
}
