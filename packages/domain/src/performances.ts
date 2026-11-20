import { z } from 'zod';
import { addDays, isLocalDate, type LocalDate } from './dates';
import { SPORTS, type Sport } from './sports';

/**
 * Résultats de référence de l’élève (D-060) : courses, tests, séances de référence. Ils servent à juger un chrono visé
 * (prédiction de Riegel), au passif (plus longue distance déjà faite) et aux équivalences de distance.
 * Modèle volontairement simple, en attendant les données du fondateur (« au pire on changera après »).
 */

export const PERFORMANCE_KINDS = ['race', 'test', 'training'] as const;
export type PerformanceKind = (typeof PERFORMANCE_KINDS)[number];
export const PERFORMANCE_KIND_LABELS: Record<PerformanceKind, string> = { race: 'Course', test: 'Test', training: 'Séance de référence' };

export interface Performance { id: string; sport: Sport; kind: PerformanceKind; name: string | null; distanceM: number; durationS: number; doneOn: LocalDate }

export const performanceSchema = z
  .object({
    sport: z.enum(SPORTS),
    kind: z.enum(PERFORMANCE_KINDS),
    name: z.string().trim().max(120).nullish().transform((v) => (v ? v : null)),
    distanceM: z.number().int().min(50, { message: '50 m au moins' }).max(1_000_000),
    durationS: z.number().int().min(10, { message: 'Temps trop court' }).max(7 * 86400),
    doneOn: z.string().refine(isLocalDate, { message: 'Date invalide' }),
  })
  .strict();
export type PerformanceInput = z.output<typeof performanceSchema>;

/** « 45:30 », « 1:45:30 », « 1h45 », « 1h45'30 », « 38'20 », « 6' » → secondes ; null si illisible. */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '').replace(/[’′]/g, "'").replace(/[″"]/g, '');
  let m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  m = t.match(/^(\d{1,3}):(\d{2})$/);
  if (m) return Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
  m = t.match(/^(\d{1,2})h(\d{1,2})?(?:'(\d{1,2}))?$/);
  if (m) return Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  m = t.match(/^(\d{1,3})'(\d{1,2})?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  return null;
}

/** Temps lisible : « 45:30 », « 1:45:30 ». */
export function formatDuration2(s: number): string {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Exposant de Riegel par sport (la course est la référence la plus éprouvée). */
const RIEGEL: Partial<Record<Sport, number>> = { running: 1.06, trail: 1.08, swimming: 1.03 };

/** Prédiction de Riegel : T2 = T1 × (D2 / D1)^k. */
export function riegel(t1: number, d1: number, d2: number, k = 1.06): number {
  return t1 * Math.pow(d2 / d1, k);
}

export interface Prediction { seconds: number; from: Performance; label: string }

/**
 * Temps prévu sur une distance, d’après le résultat récent (12 mois) du même sport le plus proche en distance
 * (entre un cinquième et cinq fois la distance visée, au-delà la prédiction devient peu fiable).
 */
export function predictTime(perfs: Performance[], sport: Sport, distanceKm: number, today: LocalDate): Prediction | null {
  const k = RIEGEL[sport];
  if (!k) return null;
  const target = distanceKm * 1000;
  const since = addDays(today, -365);
  const usable = perfs.filter((p) => p.sport === sport && p.doneOn >= since && p.doneOn <= today && p.distanceM >= target / 5 && p.distanceM <= target * 5);
  if (!usable.length) return null;
  // Le plus proche en distance ; à égalité, le plus récent.
  const best = [...usable].sort((a, b) => Math.abs(Math.log(a.distanceM / target)) - Math.abs(Math.log(b.distanceM / target)) || (a.doneOn < b.doneOn ? 1 : -1))[0]!;
  const seconds = Math.round(riegel(best.durationS, best.distanceM, target, k));
  return { seconds, from: best, label: `${best.name ?? PERFORMANCE_KIND_LABELS[best.kind]} : ${fmtKm(best.distanceM)} en ${formatDuration2(best.durationS)}` };
}

const fmtKm = (m: number) => (m < 1000 ? `${m} m` : `${String(Math.round(m / 100) / 10).replace('.', ',')} km`);

/** Équivalences course à pied : 5 km, 10 km, semi, marathon. */
export function equivalents(p: Performance): { label: string; seconds: number }[] {
  const k = RIEGEL[p.sport];
  if (!k || p.sport !== 'running') return [];
  return ([['5 km', 5000], ['10 km', 10000], ['Semi', 21097], ['Marathon', 42195]] as const)
    .map(([label, d]) => ({ label, seconds: Math.round(riegel(p.durationS, p.distanceM, d, k)) }));
}

/** VMA estimée d’un test de 5 à 7 minutes en course (vitesse moyenne tenue), km/h à une décimale ; null sinon. */
export function vmaFromTest(p: Performance): number | null {
  if (p.kind !== 'test' || (p.sport !== 'running' && p.sport !== 'trail') || p.durationS < 300 || p.durationS > 420) return null;
  return Math.round((p.distanceM / p.durationS) * 3.6 * 10) / 10;
}

/**
 * D-090 : distance d’un test (« Test 5 km », D-086) : séance dont le titre commence par « Test » et qui contient une
 * étape d’effort en distance (de 1 à 21,1 km). null sinon.
 */
export function testDistanceOf(title: string, blocks: readonly unknown[]): number | null {
  if (!/^test\b/i.test(title.trim())) return null;
  // Étapes du premier niveau seulement : une répétition n’est pas un test.
  const steps = (blocks as { type?: string; phase?: string; measure?: { kind?: string; meters?: number } }[]).filter((b) => b?.type === 'step');
  const work = steps.filter((s) => s.phase === 'work' && s.measure?.kind === 'distance' && (s.measure.meters ?? 0) >= 1000 && (s.measure.meters ?? 0) <= 21100);
  return work.length === 1 ? work[0]!.measure!.meters! : null;
}

/**
 * D-090 : VMA estimée d’une course ou d’un test en course à pied, de 3 à 21,1 km : la part de VMA tenue baisse avec la
 * durée (≈ 95 % sur 15 min, ≈ 90 % sur 30 min, 85 % au-delà d’1 h 15). Repère pour le coach, à confirmer.
 */
export function vmaFromRace(meters: number, seconds: number): number | null {
  if (meters < 3000 || meters > 21100 || seconds < 300) return null;
  const min = seconds / 60;
  const pct = Math.max(0.85, Math.min(0.95, 0.95 - (min - 15) * 0.0033));
  const v = (meters / seconds) * 3.6 / pct;
  return v >= 6 && v <= 30 ? Math.round(v * 10) / 10 : null;
}
