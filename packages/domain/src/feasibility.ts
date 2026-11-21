import { z } from 'zod';
import type { BreakLength, Experience, Level, LongestRecent, PracticeStatus, ResumedSince, WeeklyHours, WeeklySessions } from './athlete-profile';
import { isLocalDate } from './dates';
import { addDays, type LocalDate } from './dates';
import type { Sport } from './sports';
import { formatClock } from './structure';
import { formatDuration2, predictTime, type Performance, type Prediction } from './performances';

/**
 * Faisabilité d’un objectif (CE-P-07, D-057), d’après la capture 10 de Foulée : un statut parmi quatre, des critères
 * expliqués (chrono, endurance, délai, temps disponible, séances), des solutions chiffrées qui indiquent chacune le statut
 * qu’elles donneraient, des paramètres que le coach ajuste (rien n’est enregistré) et un message proposé à l’élève,
 * jamais envoyé sans lui. CoachOS étend le calcul à tous les sports. Une aide à la décision, pas une garantie.
 */

export const FEASIBILITY_STATUSES = ['realistic', 'ambitious', 'risky', 'unrealistic'] as const;
export type FeasibilityStatus = (typeof FEASIBILITY_STATUSES)[number];
/** Le statut est une indication : c’est toujours le coach qui décide (D-058). */
export const FEASIBILITY_LABELS: Record<FeasibilityStatus, string> = {
  realistic: 'Réalisable',
  ambitious: 'Ambitieux mais possible',
  risky: 'Risqué : à sécuriser',
  unrealistic: 'Irréaliste en l’état',
};

export type CriterionKey = 'history' | 'regularity' | 'chrono' | 'endurance' | 'delay' | 'time' | 'sessions';
export type CriterionLevel = 'ok' | 'watch' | 'risk' | 'block';
export interface Criterion { key: CriterionKey; label: string; level: CriterionLevel; text: string; advice: string | null }

export interface FeasibilityInput {
  sport: Sport;
  /** Distance de la course en km. */
  distanceKm: number;
  eventDate: LocalDate;
  /** Chrono visé en secondes ; null : finir. */
  targetSeconds: number | null;
  level: Level;
  practiceStatus: PracticeStatus | null;
  longestRecent: LongestRecent | null;
  weeklySessions: WeeklySessions;
  weeklyHours: WeeklyHours | null;
  today: LocalDate;
  /** Nombre exact de séances par semaine quand il est connu (jours choisis du programme), prioritaire sur la tranche. */
  sessionsPerWeek?: number;
  /** Passif de l’élève (D-058) : il pèse autant que la théorie. */
  history?: AthleteHistory;
}

export interface AthleteHistory {
  /** Années de pratique régulière déclarées. */
  experience: Experience | null;
  breakLength: BreakLength | null;
  resumedSince: ResumedSince | null;
  /** Plus longue séance réellement faite ces 6 dernières semaines (retours), en minutes. */
  recentLongestDoneMin: number | null;
  /** Régularité réelle sur 4 semaines dans CoachOS. */
  regularity: { due: number; done: number } | null;
  /** Plus longue distance déjà réalisée dans ce sport (objectif atteint ou course de référence), km. */
  achievedKm: number | null;
  /** Résultats de référence (D-060) : la prédiction est recalculée pour chaque distance évaluée. */
  performances?: Performance[];
}

/** Temps prévu sur la distance de l’objectif d’après ses résultats (Riegel), ou null. */
export function predictionOf(i: Pick<FeasibilityInput, 'sport' | 'distanceKm' | 'today' | 'history'>): Prediction | null {
  return i.history?.performances?.length ? predictTime(i.history.performances, i.sport, i.distanceKm, i.today) : null;
}

const LONG_BREAKS: ReadonlySet<BreakLength> = new Set(['6to12m', '1to3y', 'gt3y']);

/** Progression hebdomadaire de la séance longue selon le passif : un pratiquant ancien retrouve plus vite son endurance. */
export function progressionRate(i: Pick<FeasibilityInput, 'level' | 'practiceStatus' | 'history'>): number {
  const h = i.history;
  if (i.practiceStatus === 'beginner' || h?.experience === 'lt1') return 1.08;
  if (h?.breakLength && LONG_BREAKS.has(h.breakLength) && (h.resumedSince === 'lt1m' || i.practiceStatus === 'stopped')) return 1.1;
  if (h?.experience === 'gt5' || h?.experience === '3to5') return 1.15;
  if (h?.experience === '1to3') return 1.12;
  return 1.1;
}

/** Vitesse de course typique par niveau, km/h (estimation de la durée de l’épreuve quand il n’y a pas de chrono). */
const SPEED: Record<Sport, Record<Level, number>> = {
  running: { beginner: 8.5, intermediate: 10, advanced: 11.5, competitive: 13 },
  trail: { beginner: 6, intermediate: 7, advanced: 8, competitive: 9 },
  cycling: { beginner: 20, intermediate: 24, advanced: 28, competitive: 32 },
  swimming: { beginner: 2.4, intermediate: 3, advanced: 3.5, competitive: 4 },
  triathlon: { beginner: 13, intermediate: 15, advanced: 17, competitive: 19 },
  duathlon: { beginner: 15, intermediate: 17, advanced: 19, competitive: 21 },
  // D-096 : la musculation n’a pas d’épreuve en distance ; valeur neutre, la faisabilité ne la juge pas sur la vitesse.
  strength: { beginner: 1, intermediate: 1, advanced: 1, competitive: 1 },
};
/** Part de la durée d’épreuve à tenir à l’entraînement en une séance, et plafond (min). */
const LONG: Record<Sport, { part: number; cap: number }> = {
  running: { part: 0.65, cap: 180 }, trail: { part: 0.6, cap: 240 }, cycling: { part: 0.8, cap: 300 },
  swimming: { part: 1, cap: 90 }, triathlon: { part: 0.6, cap: 240 }, duathlon: { part: 0.6, cap: 210 },
  strength: { part: 1, cap: 90 },
};
const LONGEST_MIN: Record<LongestRecent, number> = { lt20: 15, '20to30': 25, '30to45': 40, '45to60': 55, '60to90': 80, '90to120': 110, gt120: 140 };
const SESSIONS_N: Record<WeeklySessions, number> = { '0to1': 1, '2to3': 2, '4to5': 4, '6plus': 6 };
const HOURS_N: Record<WeeklyHours, number> = { lt2: 1.5, '2to4': 3, '4to6': 5, '6to10': 8, gt10: 12 };
const LEVEL_FACTOR: Record<Level, number> = { beginner: 1.5, intermediate: 1.2, advanced: 1, competitive: 0.9 };
const RANK: Record<CriterionLevel, number> = { ok: 0, watch: 1, risk: 2, block: 3 };

const weeksBetween = (a: LocalDate, b: LocalDate) => Math.floor((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / (7 * 86_400_000));
const hm = (min: number) => formatClock(Math.round(min / 5) * 5 * 60);
const fmtKm = (km: number) => `${String(Math.round(km * 10) / 10).replace('.', ',')} km`;

/**
 * Durée d’épreuve (min) à l’allure du niveau de l’élève. Le chrono visé ne la change pas : il ajoute seulement des
 * exigences (critère « chrono », une séance de plus, deux semaines de plus). Ainsi, retirer le chrono ne rend jamais
 * l’objectif plus difficile.
 */
export function eventMinutes(i: Pick<FeasibilityInput, 'sport' | 'distanceKm' | 'targetSeconds' | 'level' | 'history'> & { today?: LocalDate }): number {
  // D-060 : un temps prévu d’après ses résultats vaut mieux que la vitesse typique de son niveau.
  const pr = i.today ? predictionOf(i as FeasibilityInput) : null;
  if (pr) return pr.seconds / 60;
  return (i.distanceKm / SPEED[i.sport][i.level]) * 60;
}

/** Séance la plus longue à savoir tenir (min). */
export function longNeeded(i: Pick<FeasibilityInput, 'sport' | 'distanceKm' | 'targetSeconds' | 'level' | 'history'> & { today?: LocalDate }): number {
  const h = eventMinutes(i);
  if (h <= 60) return Math.max(20, Math.round(h));
  return Math.min(LONG[i.sport].cap, Math.max(60, Math.round(h * LONG[i.sport].part)));
}

/** Semaines de préparation conseillées selon la durée d’épreuve et le niveau. */
export function weeksAdvised(i: Pick<FeasibilityInput, 'sport' | 'distanceKm' | 'targetSeconds' | 'level' | 'history'> & { today?: LocalDate }): number {
  const h = eventMinutes(i);
  const base = h <= 75 ? 6 : h <= 150 ? 10 : h <= 270 ? 14 : 18;
  // Passif : années de pratique et distance déjà réalisée raccourcissent la préparation conseillée.
  const xp = i.history?.experience === 'gt5' ? 0.8 : i.history?.experience === '3to5' ? 0.9 : 1;
  const done = i.history?.achievedKm && i.history.achievedKm >= i.distanceKm * 0.95 ? 0.75 : 1;
  return Math.max(4, Math.round(base * LEVEL_FACTOR[i.level] * xp * done)) + (i.targetSeconds ? 2 : 0);
}

/** Séances par semaine conseillées. */
export function sessionsAdvised(i: Pick<FeasibilityInput, 'sport' | 'distanceKm' | 'targetSeconds' | 'level' | 'history'> & { today?: LocalDate }): number {
  const h = eventMinutes(i);
  const base = h <= 150 ? 3 : 4;
  return base + (i.targetSeconds ? 1 : 0) - (i.level === 'beginner' && !i.targetSeconds && h <= 60 ? 1 : 0);
}

/** Endurance actuelle (min tenues d’une traite) : le plus long entre la réponse du bilan et ce qui a vraiment été fait. */
export function currentEndurance(i: Pick<FeasibilityInput, 'practiceStatus' | 'longestRecent' | 'history'>): number {
  const declared = i.practiceStatus === 'stopped' || !i.longestRecent ? (i.practiceStatus === 'beginner' ? 10 : 15) : LONGEST_MIN[i.longestRecent];
  return Math.max(declared, i.history?.recentLongestDoneMin ?? 0);
}

/** Semaines pour passer de l’endurance actuelle à la séance longue nécessaire, à la progression du passif, +2 de marge. */
export function weeksToBuild(current: number, need: number, rate = 1.1): number {
  if (current >= need) return 0;
  return Math.ceil(Math.log(need / current) / Math.log(rate)) + 2;
}

export interface Feasibility {
  status: FeasibilityStatus;
  criteria: Criterion[];
  /** Repères chiffrés utiles aux solutions et au message. */
  facts: { eventMin: number; longNeed: number; current: number; buildWeeks: number; weeksLeft: number; weeksAdvised: number; sessionsAdvised: number; sessions: number; hours: number | null; hoursNeed: number };
}

export function assessGoal(i: FeasibilityInput): Feasibility {
  const eventMin = eventMinutes(i);
  const longNeed = longNeeded(i);
  const current = currentEndurance(i);
  const buildWeeks = weeksToBuild(current, longNeed, progressionRate(i));
  const weeksLeft = weeksBetween(i.today, i.eventDate);
  const adv = weeksAdvised(i);
  const sAdv = sessionsAdvised(i);
  const sessions = i.sessionsPerWeek ?? SESSIONS_N[i.weeklySessions];
  const hours = i.weeklyHours ? HOURS_N[i.weeklyHours] : null;
  const hoursNeed = Math.round(((longNeed + (sAdv - 1) * 45) / 60) * 10) / 10;
  const c: Criterion[] = [];

  // Passif : ce que l’élève a déjà fait compte autant que la théorie (D-058).
  const h = i.history;
  if (h) {
    const parts: string[] = [];
    if (h.experience) parts.push({ lt1: 'pratique régulière depuis moins d’un an', '1to3': '1 à 3 ans de pratique régulière', '3to5': '3 à 5 ans de pratique régulière', gt5: 'plus de 5 ans de pratique régulière' }[h.experience]);
    if (h.achievedKm) parts.push(`a déjà réalisé ${fmtKm(h.achievedKm)}`);
    if (h.recentLongestDoneMin) parts.push(`plus longue séance faite ces 6 dernières semaines : ${hm(h.recentLongestDoneMin)}`);
    const fragile = Boolean(h.breakLength && LONG_BREAKS.has(h.breakLength) && (h.resumedSince === 'lt1m' || i.practiceStatus === 'stopped'));
    if (fragile) parts.push('reprise très récente après un long arrêt');
    if (parts.length) {
      c.push({
        key: 'history', label: 'Passif', level: fragile ? 'risk' : h.experience === 'lt1' && eventMin > 120 ? 'watch' : 'ok',
        text: `${parts.join(' ; ').replace(/^./, (x) => x.toUpperCase())}.${fragile ? ' La progression doit rester prudente les premières semaines.' : ''}`,
        advice: fragile ? 'Construire d’abord la régularité, puis la distance.' : null,
      });
    }
    if (h.regularity && h.regularity.due >= 3) {
      const pct = Math.round((h.regularity.done / h.regularity.due) * 100);
      c.push({
        key: 'regularity', label: 'Régularité réelle', level: pct >= 75 ? 'ok' : pct >= 50 ? 'watch' : 'risk',
        text: `${h.regularity.done} séance${h.regularity.done > 1 ? 's' : ''} faite${h.regularity.done > 1 ? 's' : ''} sur ${h.regularity.due} ces 4 dernières semaines (${pct} %).`,
        advice: pct >= 75 ? null : 'Comprendre ce qui empêche les séances avant d’augmenter la charge.',
      });
    }
  }

  // Chrono : jugé sur ses résultats de référence quand ils existent (D-060), sinon sur son niveau déclaré.
  const pred = predictionOf(i);
  if (i.targetSeconds && pred) {
    const r = i.targetSeconds / pred.seconds;
    const lvl: CriterionLevel = r >= 1 ? 'ok' : r >= 0.97 ? 'watch' : r >= 0.93 ? 'risk' : 'block';
    const gap = Math.round(Math.abs(1 - r) * 100);
    c.push({
      key: 'chrono', label: 'Chrono', level: lvl,
      text: `Temps prévu d’après ses résultats (${pred.label}) : ${formatDuration2(pred.seconds)}. Chrono visé : ${formatDuration2(i.targetSeconds)}${lvl === 'ok' ? ', à sa portée' : `, ${gap} % plus rapide que le prévu`}.`,
      advice: lvl === 'ok' ? null : 'Confirmer par un test récent, ou viser un chrono intermédiaire.',
    });
  } else if (i.targetSeconds) {
    const speed = i.distanceKm / (i.targetSeconds / 3600);
    const ratio = speed / SPEED[i.sport][i.level];
    c.push(ratio > 1.15
      ? { key: 'chrono', label: 'Chrono', level: 'risk', text: `Le chrono visé demande une vitesse nettement au-dessus de son niveau déclaré.`, advice: 'Viser de finir, ou faire un test de référence avant de fixer un chrono.' }
      : { key: 'chrono', label: 'Chrono', level: 'watch', text: 'Sans chrono de référence, impossible de dire si le chrono visé est à portée. Un test en première semaine le dira.', advice: 'Faire un test de référence en première semaine.' });
  } else c.push({ key: 'chrono', label: 'Chrono', level: 'ok', text: 'Objectif : finir. Le programme privilégie l’endurance.', advice: null });

  // Endurance : la séance longue à tenir, et le temps pour y arriver sans se blesser.
  const endLevel: CriterionLevel = buildWeeks <= weeksLeft ? (buildWeeks > weeksLeft - 2 && buildWeeks > 0 ? 'watch' : 'ok') : buildWeeks <= weeksLeft * 1.5 ? 'risk' : 'block';
  c.push({
    key: 'endurance', label: 'Endurance', level: endLevel,
    text: current >= longNeed
      ? `Tient déjà environ ${hm(current)} d’une traite : la séance longue nécessaire (${hm(longNeed)}) est acquise.`
      : `Tient environ ${hm(current)} d’une traite ; il faudra tenir environ ${hm(longNeed)} en séance longue : environ ${buildWeeks} semaines pour y arriver sans se blesser, pour ${weeksLeft} semaines avant la course.`,
    advice: endLevel === 'ok' ? null : `Une course dans ${buildWeeks} semaines environ, ou une distance plus courte d’abord.`,
  });

  // Délai : semaines restantes / conseillées pour ce niveau et cette épreuve.
  const delayLevel: CriterionLevel = weeksLeft >= adv ? 'ok' : weeksLeft >= adv * 0.75 ? 'watch' : weeksLeft >= adv * 0.5 ? 'risk' : 'block';
  c.push({ key: 'delay', label: 'Délai', level: delayLevel, text: `${Math.max(0, weeksLeft)} semaine${weeksLeft > 1 ? 's' : ''} avant la course, pour ${adv} conseillées à ce niveau et sur cette épreuve.`, advice: delayLevel === 'ok' ? null : `Repousser l’objectif d’au moins ${adv - weeksLeft} semaine${adv - weeksLeft > 1 ? 's' : ''}.` });

  // Temps disponible par semaine.
  if (hours === null) c.push({ key: 'time', label: 'Temps disponible', level: 'watch', text: 'Temps disponible par semaine non précisé dans le bilan.', advice: 'Demander combien de temps par semaine, et pour la séance longue.' });
  else {
    const t: CriterionLevel = hours >= hoursNeed ? 'ok' : hours >= hoursNeed * 0.8 ? 'watch' : hours >= hoursNeed * 0.6 ? 'risk' : 'block';
    c.push({ key: 'time', label: 'Temps disponible', level: t, text: `Environ ${String(hours).replace('.', ',')} h par semaine, pour environ ${String(hoursNeed).replace('.', ',')} h utiles (dont une séance longue de ${hm(longNeed)}).`, advice: t === 'ok' ? null : 'Libérer plus de temps, surtout un jour pour la séance longue.' });
  }

  // Séances par semaine.
  const sLevel: CriterionLevel = sessions >= sAdv ? 'ok' : sessions >= sAdv - 1 ? 'watch' : sessions >= sAdv - 2 ? 'risk' : 'block';
  c.push({ key: 'sessions', label: 'Séances', level: sLevel, text: `${sessions} séance${sessions > 1 ? 's' : ''} par semaine, pour ${sAdv} conseillées sur ${fmtKm(i.distanceKm)}${i.targetSeconds ? ' avec un chrono' : ''}.`, advice: sLevel === 'ok' ? null : `Passer à ${sAdv} séances par semaine si l’emploi du temps le permet.` });

  const worst = c.reduce((m, x) => Math.max(m, RANK[x.level]), 0);
  const status: FeasibilityStatus = (['realistic', 'ambitious', 'risky', 'unrealistic'] as const)[worst]!;
  return { status, criteria: c.sort((a, b) => RANK[b.level] - RANK[a.level]), facts: { eventMin, longNeed, current, buildWeeks, weeksLeft, weeksAdvised: adv, sessionsAdvised: sAdv, sessions, hours, hoursNeed } };
}

export interface Solution { key: string; title: string; text: string; input: FeasibilityInput; status: FeasibilityStatus }

const HOURS_ORDER: WeeklyHours[] = ['lt2', '2to4', '4to6', '6to10', 'gt10'];
const SESSIONS_ORDER: WeeklySessions[] = ['0to1', '2to3', '4to5', '6plus'];

/** Distance intermédiaire courante : marathon → semi, semi → 10 km, 10 → 5 km ; sinon la moitié. */
export function intermediateDistance(km: number): number {
  if (km > 40 && km < 45) return 21.1;
  if (km > 20 && km < 22) return 10;
  if (km >= 9 && km <= 11) return 5;
  return Math.round((km / 2) * 10) / 10;
}

/** Solutions possibles, chacune avec le statut qu’elle donnerait (comme dans Foulée). */
export function goalSolutions(i: FeasibilityInput): Solution[] {
  const a = assessGoal(i);
  const out: Omit<Solution, 'status'>[] = [];
  const needWeeks = Math.max(a.facts.buildWeeks, a.facts.weeksAdvised);
  if (needWeeks > a.facts.weeksLeft) {
    const date = addDays(i.today, needWeeks * 7);
    out.push({ key: 'later', title: 'Repousser la date de l’objectif', text: `Viser une course vers le ${new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))} : ${needWeeks} semaines, le temps de construire l’endurance sans brûler les étapes.`, input: { ...i, eventDate: date } });
  }
  if (i.weeklyHours === null || (a.facts.hours ?? 0) < a.facts.hoursNeed) {
    const target = HOURS_ORDER.find((h) => HOURS_N[h] >= a.facts.hoursNeed) ?? 'gt10';
    out.push({ key: 'time', title: 'Libérer plus de temps', text: `Environ ${String(a.facts.hoursNeed).replace('.', ',')} h par semaine, dont un jour pour la séance longue, progressivement.`, input: { ...i, weeklyHours: target } });
  }
  if (i.targetSeconds) out.push({ key: 'finish', title: 'Viser de finir, sans chrono', text: 'Garder la course, retirer la pression du chrono : le programme privilégie l’endurance.', input: { ...i, targetSeconds: null } });
  const mid = intermediateDistance(i.distanceKm);
  if (mid < i.distanceKm) out.push({ key: 'intermediate', title: 'Choisir un objectif intermédiaire', text: `Préparer d’abord ${fmtKm(mid)}, puis ${fmtKm(i.distanceKm)} sur la préparation suivante.`, input: { ...i, distanceKm: mid, targetSeconds: null } });
  if (a.facts.sessions < a.facts.sessionsAdvised) {
    const s = SESSIONS_ORDER.find((x) => SESSIONS_N[x] >= a.facts.sessionsAdvised) ?? '6plus';
    out.push({ key: 'sessions', title: 'Ajouter des séances', text: `Passer à ${a.facts.sessionsAdvised} séances par semaine si l’emploi du temps le permet.`, input: { ...i, weeklySessions: s } });
  }
  out.push({ key: 'keep', title: 'Maintenir l’objectif initial', text: 'Possible, en le disant clairement à l’élève : le niveau d’incertitude reste celui ci-dessus et le suivi devra être rapproché.', input: i });
  return out.map((s) => ({ ...s, status: assessGoal(s.input).status }));
}

const longDate = (d: LocalDate) => new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));

/** Ce que le coach a changé par rapport à l’objectif de départ, en phrases pour l’élève. */
export function describeChanges(from: FeasibilityInput, to: FeasibilityInput): string[] {
  const out: string[] = [];
  if (to.distanceKm !== from.distanceKm) out.push(to.distanceKm < from.distanceKm ? `préparer d’abord ${fmtKm(to.distanceKm)}, puis ${fmtKm(from.distanceKm)} sur la préparation suivante` : `viser ${fmtKm(to.distanceKm)}`);
  if (to.eventDate !== from.eventDate) out.push(`viser une course vers le ${longDate(to.eventDate)}`);
  if (from.targetSeconds && !to.targetSeconds) out.push('viser de finir, sans chrono');
  else if (to.targetSeconds && to.targetSeconds !== from.targetSeconds) out.push(`viser ${formatClock(to.targetSeconds)}`);
  if (to.weeklySessions !== from.weeklySessions) out.push(`passer à ${SESSIONS_N[to.weeklySessions]} séances par semaine`);
  if (to.weeklyHours !== from.weeklyHours && to.weeklyHours) out.push(`prévoir environ ${String(HOURS_N[to.weeklyHours]).replace('.', ',')} h par semaine`);
  return out;
}

const STATUS_PHRASE: Record<FeasibilityStatus, string> = {
  realistic: 'il est réalisable', ambitious: 'il est ambitieux mais possible, à condition d’être régulier',
  risky: 'dans les conditions actuelles, il me paraît risqué', unrealistic: 'dans les conditions actuelles, il me paraît trop juste',
};

/**
 * Message proposé à l’élève : le coach le relit, le modifie et l’envoie lui-même.
 * Sans ajustement : le statut, les points qui comptent et les solutions. Avec un ajustement essayé : ce qui change et le statut obtenu.
 */
export function goalMessage(first: string, goalTitle: string, initial: { input: FeasibilityInput; a: Feasibility }, current: { input: FeasibilityInput; a: Feasibility }, solutions: Solution[]): string {
  const changes = describeChanges(initial.input, current.input);
  const parts = [`Bonjour ${first}, j’ai regardé ton objectif « ${goalTitle} » avec ton bilan : ${STATUS_PHRASE[initial.a.status]}.`];
  const points = initial.a.criteria.filter((c) => c.level !== 'ok').slice(0, 3).map((c) => `– ${c.label} : ${c.text}`);
  if (points.length && initial.a.status !== 'realistic') parts.push(`Ce qui compte le plus :\n${points.join('\n')}`);
  if (changes.length) {
    parts.push(`Je te propose de ${changes.join(', et de ')}. Ainsi, ${STATUS_PHRASE[current.a.status].replace('dans les conditions actuelles, ', '')}.`);
  } else {
    const props = solutions.filter((s) => s.key !== 'keep').slice(0, 3).map((s) => `– ${s.title} : ${s.text}`);
    if (props.length && initial.a.status !== 'realistic') parts.push(`Je te propose :\n${props.join('\n')}`);
  }
  parts.push('Qu’en penses-tu ? On peut en parler à l’occasion d’un appel.');
  return parts.join('\n\n');
}

/** Chrono lu dans le titre : « en moins de 1 h 45 », « en 3h45 », « sous 50 min » ; null sinon. */
export function chronoFromTitle(title: string): number | null {
  const t = title.toLowerCase();
  const hm = t.match(/(?:en|sous|moins de)\s*(?:moins de\s*)?(\d{1,2})\s*h\s*(\d{1,2})?/);
  if (hm) return Number(hm[1]) * 3600 + Number(hm[2] ?? 0) * 60;
  const m = t.match(/(?:en|sous|moins de)\s*(?:moins de\s*)?(\d{1,3})\s*(?:min|′|')/);
  return m ? Number(m[1]) * 60 : null;
}

/** Distance par défaut quand le titre ne la donne pas (le coach l’ajuste dans les paramètres). */
export const DEFAULT_GOAL_KM: Record<Sport, number> = { running: 10, trail: 20, cycling: 50, swimming: 1.5, triathlon: 51.5, duathlon: 30, strength: 0 };

/** Distance lue dans le titre d’un objectif : « Marathon », « semi », « 10 km », « Trail 30 km »… ; null sinon. */
export function distanceFromTitle(title: string): number | null {
  const t = title.toLowerCase();
  const km = t.match(/(\d+(?:[.,]\d+)?)\s*km/);
  if (km) return Number(km[1]!.replace(',', '.'));
  if (/semi/.test(t)) return 21.1;
  if (/marathon/.test(t)) return 42.2;
  if (/ironman|\b226\b/.test(t)) return 226;
  if (/70[.,]3/.test(t)) return 113;
  return null;
}

/** Décision du coach sur un objectif (D-058) : paramètres validés et justification. Le programme devra les atteindre. */
export const goalDecisionSchema = z
  .object({
    statusAtDecision: z.enum(FEASIBILITY_STATUSES),
    params: z.object({
      distanceKm: z.number().positive().max(1000),
      eventDate: z.string().refine(isLocalDate, { message: 'Date invalide' }),
      targetSeconds: z.number().int().min(60).max(7 * 86400).nullable(),
      weeklySessions: z.enum(['0to1', '2to3', '4to5', '6plus']),
      weeklyHours: z.enum(['lt2', '2to4', '4to6', '6to10', 'gt10']).nullable(),
    }).strict(),
    note: z.string().max(1000, { message: '1000 caractères au plus' }).nullish().transform((v) => (v?.trim() ? v.trim() : null)),
    /** Reporter la date validée sur l’objectif (visible par l’élève). */
    applyDate: z.boolean().default(false),
  })
  .strict();
export type GoalDecisionInput = z.output<typeof goalDecisionSchema>;
