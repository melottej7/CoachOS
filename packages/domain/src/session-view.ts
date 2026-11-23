import type { Sport } from './sports';
import { sessionProfile } from './session-profile';
import {
  describeBlock, describeIntensity, describeMeasure, formatKm, PHASE_LABELS, personalTarget, roundEstimate, structureTotals,
  type Block, type References, type Step,
} from './structure';

/**
 * D-129 · Lecture d’une séance « d’un coup d’œil » (refonte, direction Chrono) : chiffres clés, bande des zones,
 * une ligne par bloc avec la cible traduite pour l’élève. Calcul pur, partagé par l’élève et le coach.
 */
export interface SessionRow {
  /** Zone dominante du bloc (la plus haute), 0 si l’intensité n’est pas une zone. */
  zone: number;
  title: string;
  detail: string | null;
  /** Cible personnelle : « 6:09 à 5:33 /km », « 180 à 225 W ». */
  target: string | null;
  repeat: boolean;
  /** Pastille quand il n’y a pas de zone : « 4× » pour des séries. */
  badge: string | null;
}

export interface SessionView {
  /** Musculation (exercices) ou endurance (zones). */
  kind: 'endurance' | 'strength';
  exercises: number;
  sets: number;
  minutes: number | null;
  minutesApprox: boolean;
  km: string | null;
  kmApprox: boolean;
  /** Bande : une entrée par étape dépliée, zone 0 si inconnue. */
  segments: { zone: number; seconds: number }[];
  rows: SessionRow[];
  /** Zone la plus haute de la séance (0 si aucune). */
  keyZone: number;
}

const zoneOf = (s: Step): number => (s.intensity.kind === 'zone' ? s.intensity.zone : 0);

function maxZone(b: Block): number {
  return b.type === 'step' ? zoneOf(b) : Math.max(0, ...b.steps.map(maxZone));
}

function firstZoned(b: Block): Step | null {
  if (b.type === 'step') return zoneOf(b) ? b : null;
  const all = b.steps.map(firstZoned).filter((x): x is Step => x !== null);
  return all.sort((a, c) => zoneOf(c) - zoneOf(a))[0] ?? null;
}

function stepRow(s: Step, sport: Sport, refs?: References): SessionRow {
  const intensity = s.intensity.kind === 'zone' ? null : describeIntensity(s.intensity);
  if (s.exercise) {
    return { zone: 0, title: s.exercise.name, detail: [describeMeasure(s.measure), intensity, s.note].filter(Boolean).join(' · '), target: null, repeat: false, badge: '1×' };
  }
  return {
    zone: zoneOf(s),
    title: `${describeMeasure(s.measure)} · ${PHASE_LABELS[s.phase].toLocaleLowerCase('fr')}`,
    detail: [intensity, s.note].filter(Boolean).join(' · ') || null,
    target: personalTarget(s, sport, refs),
    repeat: false,
    badge: null,
  };
}

const flat = (bs: Block[]): Step[] => bs.flatMap((b) => (b.type === 'step' ? [b] : flat(b.steps)));
const hasExercise = (b: Block) => flat([b]).some((x) => x.exercise);

/** Séries de musculation : « Squat goblet », « 4 séries · 10 répétitions · 16 kg · repos 1 min 30 s ». */
function strengthRow(b: Extract<Block, { type: 'repeat' }>): SessionRow {
  const steps = flat(b.steps);
  const work = steps.filter((x) => x.exercise);
  const rest = steps.find((x) => !x.exercise && x.phase === 'rest');
  const names = [...new Set(work.map((x) => x.exercise!.name))];
  const what = work.map((x) => [describeMeasure(x.measure), x.intensity.kind === 'load' ? describeIntensity(x.intensity) : null].filter(Boolean).join(' · '));
  return {
    zone: 0,
    title: names.join(' + '),
    detail: [`${b.times} ${names.length > 1 ? 'tours' : 'séries'}`, [...new Set(what)].join(' / '), rest ? `repos ${describeMeasure(rest.measure)}` : null].filter(Boolean).join(' · '),
    target: null,
    repeat: true,
    badge: `${b.times}×`,
  };
}

export function sessionView(blocks: Block[], sport: Sport, refs?: References, declaredSeconds?: number | null): SessionView {
  const totals = structureTotals(blocks, { sport, refs });
  const seconds = totals.seconds || declaredSeconds || 0;
  const bars = blocks.length ? sessionProfile(blocks, sport, refs) : [];
  const rows = blocks.map((b): SessionRow => {
    if (b.type === 'step') return stepRow(b, sport, refs);
    if (hasExercise(b)) return strengthRow(b);
    const key = firstZoned(b);
    // Effort puis récupération : « 3 × 8 min », « récupération 3 min en Z1 ».
    const [work, rec] = b.steps;
    if (b.steps.length === 2 && work?.type === 'step' && rec?.type === 'step' && (rec.phase === 'recovery' || rec.phase === 'rest')) {
      const recZone = zoneOf(rec);
      return {
        zone: maxZone(b), title: `${b.times} × ${describeMeasure(work.measure)}`,
        detail: `récupération ${describeMeasure(rec.measure)}${recZone ? ` en Z${recZone}` : ''}`,
        target: key ? personalTarget(key, sport, refs) : null, repeat: true, badge: null,
      };
    }
    return { zone: maxZone(b), title: describeBlock(b, sport).replace(/ · Z\d \([^)]*\)/g, (m) => m.replace(/ \([^)]*\)/, '')), detail: null, target: key ? personalTarget(key, sport, refs) : null, repeat: true, badge: null };
  });
  const strengthSession = sport === 'strength' || blocks.some(hasExercise);
  const exerciseNames = new Set(flat(blocks).filter((x) => x.exercise).map((x) => x.exercise!.name));
  const sets = blocks.reduce((n, b) => n + (b.type === 'repeat' && hasExercise(b) ? b.times : b.type === 'step' && b.exercise ? 1 : 0), 0);
  return {
    kind: strengthSession ? 'strength' : 'endurance',
    exercises: exerciseNames.size,
    sets,
    minutes: seconds ? Math.round(roundEstimate({ ...totals, seconds }) / 60) : null,
    minutesApprox: totals.estimated || totals.unknownTime,
    km: totals.totalMeters ? formatKm(totals.totalMeters) : null,
    kmApprox: totals.distanceEstimated || totals.unknownDistance,
    segments: bars.map((x) => ({ zone: x.levelKnown ? x.level : 0, seconds: x.seconds })),
    rows,
    keyZone: Math.max(0, ...blocks.map(maxZone)),
  };
}
