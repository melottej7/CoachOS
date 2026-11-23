import { addDays, weekStart, type LocalDate } from './dates';
import type { Sport } from './sports';

// Statistiques d’entraînement (CE-S-01, CE-S-02, CE-E-03, D-037) : prévu et réalisé par semaine, sur les séances publiées.

export interface StatItem {
  localDate: LocalDate;
  canceled: boolean;
  plannedSeconds: number | null;
  plannedMeters: number | null;
  state: 'completed' | 'partial' | 'missed' | 'postponed' | null;
  doneSeconds: number | null;
  doneMeters: number | null;
  rpe: number | null;
  feeling: number | null;
  /** Sport de la séance (répartition du volume réalisé, D-121). */
  sport?: Sport | null;
}

/** Part d’un sport dans le volume réalisé de la période. */
export interface SportShare {
  sport: Sport;
  doneSeconds: number;
  /** Pourcentage arrondi du volume réalisé. */
  share: number;
}

export interface WeekStat {
  monday: LocalDate;
  planned: number;
  done: number;
  missed: number;
  plannedSeconds: number;
  doneSeconds: number;
  plannedMeters: number;
  doneMeters: number;
  /** D-121 · Charge : minutes réalisées × effort ressenti, séances faites avec effort noté. */
  load: number;
  /** Effort moyen des séances faites de la semaine. */
  avgRpe: number | null;
}

export interface StatsSummary {
  weeks: WeekStat[];
  /** Séances publiées de la période déjà passées (jusqu’à aujourd’hui inclus), hors annulées. */
  due: number;
  done: number;
  missed: number;
  /** Séances passées sans retour. */
  noFeedback: number;
  /** done / due, en %, ou null sans séance passée. */
  completion: number | null;
  plannedSeconds: number;
  doneSeconds: number;
  plannedMeters: number;
  doneMeters: number;
  avgRpe: number | null;
  avgFeeling: number | null;
  /** Semaines consécutives (jusqu’à la semaine en cours) avec au moins une séance faite. */
  streakWeeks: number;
  /** D-121 · Charge totale de la période (points) et nombre de séances qui la composent. */
  load: number;
  loadSessions: number;
  /** D-121 · Volume réalisé par sport, du plus grand au plus petit. */
  bySport: SportShare[];
}

const isDone = (s: StatItem['state']) => s === 'completed' || s === 'partial';
/** Charge d’une séance faite : minutes réalisées × effort ressenti ; sans effort noté, pas de charge. */
const loadOf = (i: StatItem): number => (isDone(i.state) && i.rpe !== null ? Math.round((doneVolume(i).s / 60) * i.rpe) : 0);
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Séance faite : durée et distance déclarées, sinon celles prévues si la séance est réalisée en entier. */
function doneVolume(i: StatItem): { s: number; m: number } {
  if (!isDone(i.state)) return { s: 0, m: 0 };
  const full = i.state === 'completed';
  return { s: i.doneSeconds ?? (full ? i.plannedSeconds ?? 0 : 0), m: i.doneMeters ?? (full ? i.plannedMeters ?? 0 : 0) };
}

export function summarize(items: StatItem[], from: LocalDate, to: LocalDate, today: LocalDate): StatsSummary {
  const live = items.filter((i) => !i.canceled && i.localDate >= from && i.localDate <= to);
  const weeks: WeekStat[] = [];
  for (let m = weekStart(from); m <= to; m = addDays(m, 7)) {
    const w = live.filter((i) => i.localDate >= m && i.localDate <= addDays(m, 6));
    const v = w.map(doneVolume);
    const wr = w.filter((i) => isDone(i.state)).map((i) => i.rpe).filter((x): x is number => x !== null);
    weeks.push({
      monday: m,
      planned: w.length,
      done: w.filter((i) => isDone(i.state)).length,
      missed: w.filter((i) => i.state === 'missed').length,
      plannedSeconds: w.reduce((n, i) => n + (i.plannedSeconds ?? 0), 0),
      doneSeconds: v.reduce((n, x) => n + x.s, 0),
      plannedMeters: w.reduce((n, i) => n + (i.plannedMeters ?? 0), 0),
      doneMeters: v.reduce((n, x) => n + x.m, 0),
      load: w.reduce((n, i) => n + loadOf(i), 0),
      avgRpe: avg(wr),
    });
  }
  const share = new Map<Sport, number>();
  for (const i of live) {
    const sec = doneVolume(i).s;
    if (i.sport && sec) share.set(i.sport, (share.get(i.sport) ?? 0) + sec);
  }
  const totalDone = [...share.values()].reduce((a, b) => a + b, 0);
  const bySport: SportShare[] = [...share.entries()]
    .map(([sport, doneSeconds]) => ({ sport, doneSeconds, share: totalDone ? Math.round((doneSeconds / totalDone) * 100) : 0 }))
    .sort((a, b) => b.doneSeconds - a.doneSeconds);
  const past = live.filter((i) => i.localDate <= today);
  const done = past.filter((i) => isDone(i.state));
  let streakWeeks = 0;
  for (let k = weeks.length - 1; k >= 0; k--) {
    const w = weeks[k]!;
    if (w.monday > today) continue;
    if (w.done > 0) streakWeeks++;
    else if (w.monday === weekStart(today)) continue; // la semaine en cours n’interrompt pas la série
    else break;
  }
  return {
    weeks,
    due: past.length,
    done: done.length,
    missed: past.filter((i) => i.state === 'missed').length,
    noFeedback: past.filter((i) => i.state === null).length,
    completion: past.length ? Math.round((done.length / past.length) * 100) : null,
    plannedSeconds: live.reduce((n, i) => n + (i.plannedSeconds ?? 0), 0),
    doneSeconds: weeks.reduce((n, w) => n + w.doneSeconds, 0),
    plannedMeters: live.reduce((n, i) => n + (i.plannedMeters ?? 0), 0),
    doneMeters: weeks.reduce((n, w) => n + w.doneMeters, 0),
    avgRpe: avg(done.map((i) => i.rpe).filter((x): x is number => x !== null)),
    avgFeeling: avg(done.map((i) => i.feeling).filter((x): x is number => x !== null)),
    streakWeeks,
    load: weeks.reduce((n, w) => n + w.load, 0),
    loadSessions: live.filter((i) => loadOf(i) > 0).length,
    bySport,
  };
}

/** Définitions affichées sous les statistiques (CE-S-03). */
export const STAT_DEFINITIONS = [
  ['Régularité', 'séances faites (en entier ou en partie) parmi les séances publiées déjà passées, annulées exclues'],
  ['Volume réalisé', 'durée déclarée par l’élève ; à défaut, durée prévue pour une séance faite en entier'],
  ['Effort ressenti', 'moyenne de l’effort de 0 à 10 donné dans les retours'],
  ['Charge d’entraînement', 'minutes réalisées multipliées par l’effort ressenti (0 à 10), séance par séance, puis additionnées ; une séance sans effort noté ne compte pas. Rien à voir avec les charges en kilos de la musculation'],
  ['Par sport', 'part de chaque sport dans le volume réalisé de la période'],
  ['Série', 'semaines consécutives avec au moins une séance faite ; la semaine en cours ne la coupe pas'],
  ['Comparaison', 'avec la période de même durée juste avant ; la semaine en cours, pas encore terminée, est comprise dans la période actuelle'],
] as const;

/** Écart avec la période précédente (CE-S-04, D-050), ou null si l’une des deux n’a pas de quoi comparer. */
export interface PeriodDelta {
  /** Différence de régularité, en points. */
  completionPts: number | null;
  /** Variation du volume réalisé, en %. */
  volumePct: number | null;
  /** Variation de la distance réalisée, en %. */
  distancePct: number | null;
  /** Différence d’effort moyen, sur 10. */
  rpeDiff: number | null;
  /** D-121 · Variation de la charge, en %. */
  loadPct: number | null;
}

const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

export function comparePeriods(cur: StatsSummary, prev: StatsSummary): PeriodDelta {
  return {
    completionPts: cur.completion !== null && prev.completion !== null ? cur.completion - prev.completion : null,
    volumePct: prev.due ? pct(cur.doneSeconds, prev.doneSeconds) : null,
    distancePct: prev.due ? pct(cur.doneMeters, prev.doneMeters) : null,
    rpeDiff: cur.avgRpe !== null && prev.avgRpe !== null ? Math.round((cur.avgRpe - prev.avgRpe) * 10) / 10 : null,
    loadPct: prev.due ? pct(cur.load, prev.load) : null,
  };
}

/** « en hausse de 12 points », « stable », « en baisse de 8 % » : le sens est écrit, jamais porté par la couleur seule. */
export function deltaText(value: number | null, unit: 'pts' | 'pct' | 'rpe'): string | null {
  if (value === null) return null;
  const abs = Math.abs(value);
  const fmt = unit === 'pts' ? `${abs} point${abs > 1 ? 's' : ''}` : unit === 'pct' ? `${abs} %` : `${String(abs).replace('.', ',')}`;
  if (value === 0 || (unit === 'pct' && abs < 3) || (unit === 'rpe' && abs < 0.3)) return 'stable';
  return `${value > 0 ? 'en hausse' : 'en baisse'} de ${fmt}`;
}

/** Compte à rebours vers une échéance. */
export function daysUntil(today: LocalDate, target: LocalDate): number {
  return Math.round((Date.parse(`${target}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}
