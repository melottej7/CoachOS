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

export const ZONE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Z1 (très facile)', 2: 'Z2 (endurance)', 3: 'Z3 (tempo)', 4: 'Z4 (seuil)', 5: 'Z5 (VMA)',
};

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
    z.object({ kind: z.literal('zone'), zone: int(1, 5) }).strict(),
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
  meters: number;
  /** Vrai si une partie du temps est estimée (distance + allure) ou inconnue (bloc libre, distance sans allure). */
  estimated: boolean;
  unknownTime: boolean;
}

function paceSeconds(i: Intensity): { perMeter: number } | null {
  if (i.kind !== 'pace') return null;
  const avg = i.max === null ? i.min : (i.min + i.max) / 2;
  return { perMeter: i.unit === 'per_km' ? avg / 1000 : avg / 100 };
}

/** Durée et distance totales d’une structure, répétitions comprises. */
export function structureTotals(blocks: Block[]): Totals {
  const t: Totals = { seconds: 0, meters: 0, estimated: false, unknownTime: false };
  const add = (b: Block, factor: number) => {
    if (b.type === 'repeat') {
      for (const s of b.steps) add(s, factor * b.times);
      return;
    }
    if (b.measure.kind === 'time') t.seconds += b.measure.seconds * factor;
    else if (b.measure.kind === 'distance') {
      t.meters += b.measure.meters * factor;
      const p = paceSeconds(b.intensity);
      if (p) {
        t.seconds += Math.round(b.measure.meters * p.perMeter) * factor;
        t.estimated = true;
      } else t.unknownTime = true;
    } else t.unknownTime = true;
  };
  for (const b of blocks) add(b, 1);
  t.seconds = Math.round(t.seconds);
  return t;
}

// ---------- Texte lisible ----------

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  if (m && s) return `${m} min ${String(s).padStart(2, '0')}`;
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
    case 'zone': return ZONE_LABELS[i.zone as 1 | 2 | 3 | 4 | 5];
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
  if (t.seconds) parts.push(`${t.unknownTime ? 'au moins ' : t.estimated ? '≈ ' : ''}${formatClock(t.seconds)}`);
  if (t.meters) parts.push(formatMeters(t.meters));
  return parts.length ? parts.join(' · ') : 'durée libre';
}
