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

/**
 * Échelle à 7 zones (D-029), mêlée à celle des programmes du fondateur (D-087) : les 7 zones de CoachOS gardent leur
 * finesse, leurs repères viennent de ses documents (allure de course et sensation). Ses documents comptent un cran
 * plus bas : sa « Z1-2 » = Z2, sa Z3 (seuil, allure 10 km) = Z4, sa Z4 (allure 5 km) = Z5, sa Z5 (VMA) = Z6.
 */
export const ZONES = [1, 2, 3, 4, 5, 6, 7] as const;
export type Zone = (typeof ZONES)[number];
export const ZONE_NAMES: Record<Zone, string> = {
  1: 'récupération', 2: 'endurance fondamentale', 3: 'endurance active', 4: 'seuil', 5: 'allure 5 km', 6: 'VMA', 7: 'vitesse',
};
/** Repères de chaque zone (D-087) : à quoi elle sert et ce qu’on ressent, tirés des programmes du fondateur. */
export const ZONE_GUIDE: Record<Zone, { use: string; feel: string; doc: string }> = {
  1: { use: 'trot entre deux efforts, footing de récup', feel: 'très facile', doc: 'récup' },
  2: { use: 'footing, sortie longue', feel: 'tu parles en phrases complètes', doc: 'Z1-2, EF' },
  3: { use: 'allure marathon, sortie longue avec allures', feel: 'tu parles par bouts de phrase', doc: 'Z2' },
  4: { use: 'tempo, allure semi à 10 km', feel: 'soutenu mais tenable, quelques mots', doc: 'Z3' },
  5: { use: 'fractionné 1 km, pyramide', feel: 'dur mais tenable', doc: 'Z4' },
  6: { use: 'fractionné 200 à 400 m', feel: 'intense, jamais un sprint', doc: 'Z5' },
  7: { use: 'lignes droites, côtes courtes', feel: 'vite mais relâché', doc: 'Z6' },
};
export const ZONE_LABELS: Record<Zone, string> = Object.fromEntries(
  ZONES.map((z) => [z, `Z${z} (${ZONE_NAMES[z]})`]),
) as Record<Zone, string>;

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const measureSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('time'), seconds: int(1, 86400) }).strict(),
  z.object({ kind: z.literal('distance'), meters: int(1, 1_000_000) }).strict(),
  z.object({ kind: z.literal('open') }).strict(),
  // D-096 : musculation, un nombre de répétitions (la série est une répétition de blocs : 4 × (10 squats + repos)).
  z.object({ kind: z.literal('reps'), reps: int(1, 500) }).strict(),
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
    // D-096 : charge en kg (au demi-kilo), sans charge = poids du corps.
    z.object({ kind: z.literal('load'), ...range(z.number().min(0.5).max(500).multipleOf(0.5)).shape }).strict(),
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
    /** D-096 : exercice de musculation (référence de la bibliothèque et nom recopié, lisible même si l’exercice est retiré). */
    exercise: z
      .object({ id: z.string().uuid().nullish().transform((v) => v ?? null), name: z.string().trim().min(1).max(80) })
      .strict()
      .nullish(),
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

/** Durée estimée d’une répétition de musculation, mise en place comprise (D-096). */
export const REP_SECONDS = 4;

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
  /** Puissance au seuil, W (vélo, D-055). */
  ftpW?: number | null;
  /** Vitesse critique de nage : secondes pour 100 m (natation, D-055). */
  cssSecPer100?: number | null;
}

/**
 * Plages cibles en % de VMA (D-029, recalées D-087 sur les allures de course : marathon ≈ 80 %, semi ≈ 85 %,
 * 10 km ≈ 90 %, 5 km ≈ 95 %, VMA = 100 %).
 */
export const ZONE_TARGET_PCT: Record<Zone, readonly [number, number]> = {
  1: [55, 65], 2: [65, 75], 3: [75, 85], 4: [85, 92], 5: [92, 97], 6: [97, 105], 7: [105, 120],
};
const VMA_SPORTS: ReadonlySet<Sport> = new Set(['running', 'trail']);

/**
 * Vélo (D-055) : zones en % de FTP, alignées sur les 7 zones (récupération, endurance, tempo, seuil, PMA, anaérobie, sprint).
 * Natation : zones en % de la vitesse CSS. Plages réversibles, à valider par le fondateur.
 */
export const ZONE_FTP_PCT: Record<Zone, readonly [number, number]> = {
  1: [45, 55], 2: [56, 75], 3: [76, 90], 4: [91, 105], 5: [106, 120], 6: [121, 150], 7: [151, 180],
};
export const ZONE_CSS_PCT: Record<Zone, readonly [number, number]> = {
  1: [70, 78], 2: [78, 88], 3: [88, 94], 4: [95, 100], 5: [100, 105], 6: [105, 110], 7: [110, 118],
};
const FTP_SPORTS: ReadonlySet<Sport> = new Set(['cycling']);
const CSS_SPORTS: ReadonlySet<Sport> = new Set(['swimming']);
export const usesFtp = (sport: Sport | null | undefined) => Boolean(sport && FTP_SPORTS.has(sport));
export const usesCss = (sport: Sport | null | undefined) => Boolean(sport && CSS_SPORTS.has(sport));

/** Puissance cible d’une zone, arrondie à 5 W : [basse, haute]. */
export function zonePower(zone: Zone, ftpW: number): [number, number] {
  const [lo, hi] = ZONE_FTP_PCT[zone];
  return [Math.round((ftpW * lo) / 100 / 5) * 5, Math.round((ftpW * hi) / 100 / 5) * 5];
}

/** Allure de nage d’une zone en secondes pour 100 m : [la plus lente, la plus rapide]. */
export function zoneSwimPace(zone: Zone, cssSecPer100: number): [number, number] {
  const [lo, hi] = ZONE_CSS_PCT[zone];
  return [Math.round((cssSecPer100 * 100) / lo), Math.round((cssSecPer100 * 100) / hi)];
}

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
  if (step.intensity.kind === 'zone' && refs?.cssSecPer100 && usesCss(sport)) {
    const [lo, hi] = ZONE_CSS_PCT[step.intensity.zone as Zone];
    return (100 / refs.cssSecPer100) * ((lo + hi) / 2 / 100);
  }
  return null;
}

/** Estimation d’une étape : allure cible (s/km, course), durée ou distance déduite. */
export function stepEstimate(step: Step, sessionSport?: Sport, refs?: References): {
  pace: [number, number] | null; swimPace: [number, number] | null; power: [number, number] | null; seconds: number | null; meters: number | null;
} {
  const sport = step.sport ?? sessionSport;
  const i = step.intensity;
  let pace: [number, number] | null = null;
  let swimPace: [number, number] | null = null;
  let power: [number, number] | null = null;
  if (i.kind === 'pace' && i.unit === 'per_km') pace = [i.min, i.max ?? i.min];
  else if (i.kind === 'zone' && refs?.vmaKmh && usesVma(sport)) pace = zonePace(i.zone as Zone, refs.vmaKmh);
  if (i.kind === 'zone' && refs?.cssSecPer100 && usesCss(sport)) swimPace = zoneSwimPace(i.zone as Zone, refs.cssSecPer100);
  if (i.kind === 'zone' && refs?.ftpW && usesFtp(sport)) power = zonePower(i.zone as Zone, refs.ftpW);
  if (i.kind === 'power' && i.unit === 'pct_ftp' && refs?.ftpW) {
    power = [Math.round((refs.ftpW * i.min) / 100 / 5) * 5, Math.round((refs.ftpW * (i.max ?? i.min)) / 100 / 5) * 5];
  }
  const v = speedOf(step, sessionSport, refs);
  return {
    pace, swimPace, power,
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
    } else if (b.measure.kind === 'reps') {
      // D-096 : environ 4 secondes par répétition ; pas de distance en musculation.
      t.seconds += b.measure.reps * REP_SECONDS * factor;
      t.estimated = true;
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
const kg = (n: number) => n.toLocaleString('fr-BE', { maximumFractionDigits: 1 });
const rng = (min: number, max: number | null, f: (n: number) => string = String) => (max === null || max === min ? f(min) : `${f(min)} à ${f(max)}`);

export function describeMeasure(m: Measure): string {
  if (m.kind === 'time') return formatClock(m.seconds);
  if (m.kind === 'distance') return formatMeters(m.meters);
  if (m.kind === 'reps') return `${m.reps} répétition${m.reps > 1 ? 's' : ''}`;
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
    case 'load': return `${rng(i.min, i.max, kg)} kg`;
  }
}

export function describeStep(s: Step, sessionSport?: Sport): string {
  const parts = [describeMeasure(s.measure)];
  const intensity = describeIntensity(s.intensity);
  if (intensity) parts.push(intensity);
  if (s.cadence) parts.push(`cadence ${rng(s.cadence.min, s.cadence.max)}`);
  const sport = s.sport && s.sport !== sessionSport ? `${SPORT_LABELS[s.sport]} · ` : '';
  // D-096 : un exercice se lit par son nom (« Squat · 10 répétitions · 40 kg »).
  const head = s.exercise ? s.exercise.name : PHASE_LABELS[s.phase];
  return `${sport}${head} · ${parts.join(' · ')}${s.note ? ` (${s.note})` : ''}`;
}

/** Une ligne par bloc, lisible par l’athlète : « 5 × (400 m · Z5 / 200 m · Z1) ». */
export function describeBlock(b: Block, sessionSport?: Sport): string {
  if (b.type === 'step') return describeStep(b, sessionSport);
  const inner = b.steps.map((s) => (s.type === 'step' ? `${s.exercise ? `${s.exercise.name} · ` : ''}${describeMeasure(s.measure)}${describeIntensity(s.intensity) ? ` · ${describeIntensity(s.intensity)}` : ''}` : describeBlock(s, sessionSport)));
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

/** Traduction personnelle d’une cible pour cet élève : « 6:09 à 5:43 /km », « 180 à 225 W », « 1:52 à 1:45 /100 m ». */
export function personalTarget(step: Step, sessionSport?: Sport, refs?: References): string | null {
  const e = stepEstimate(step, sessionSport, refs);
  const two = (a: string, b: string, unit: string) => (a === b ? `${a} ${unit}` : `${a} à ${b} ${unit}`);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (step.intensity.kind === 'zone' && e.pace) return two(mmss(e.pace[0]), mmss(e.pace[1]), '/km');
  if (e.swimPace) return two(mmss(e.swimPace[0]), mmss(e.swimPace[1]), '/100 m');
  if (e.power) return two(String(e.power[0]), String(e.power[1]), 'W');
  return null;
}

/** Allure « 5:43 /km ». */
export function formatPace(secPerKm: number): string {
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')} /km`;
}
