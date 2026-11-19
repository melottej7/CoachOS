import { z } from 'zod';
import { addDays, isLocalDate, type LocalDate } from './dates';
import { assessGoal, currentEndurance, longNeeded, eventMinutes, type FeasibilityInput } from './feasibility';
import { predictionOf } from './feasibility';
import { FOULEE_LEVEL_OF, FOULEE_PHASES_OF, type FouleeLevel, type FouleePhase } from './foulee-library';
import type { Sport } from './sports';
import { formatClock, structureTotals, type Block, type References, type Step } from './structure';

/**
 * Générateur de programme (lot P, D-061), règle du fondateur :
 * 1. le programme est à la hauteur de l’objectif validé par le coach (D-058) : il ne le revoit jamais à la baisse ;
 * 2. les 4 premières semaines sont un tremplin, de ce que l’élève fait aujourd’hui vers le volume nécessaire ensuite ;
 * 3. les risques sont signalés au coach, qui décide ; rien n’est bloqué, tout est créé en brouillons.
 * Règles écrites et vérifiables (pas d’IA) : développement avec une semaine allégée sur quatre, affûtage avant la course.
 */

export type ProgramPhase = 'tremplin' | 'developpement' | 'recuperation' | 'affutage';
export const PROGRAM_PHASE_LABELS: Record<ProgramPhase, string> = {
  tremplin: 'Tremplin', developpement: 'Développement', recuperation: 'Semaine allégée', affutage: 'Affûtage',
};
export type SessionKind = 'easy' | 'long' | 'quality' | 'race';

export interface ProgramSession {
  date: LocalDate; kind: SessionKind; title: string; blocks: Block[]; minutes: number;
  /** « Pourquoi cette séance ? » (D-062) : sa place dans le programme, en une phrase. */
  why: string;
  /** Séance tirée de la bibliothèque du coach, ou construite par le générateur. */
  source: 'library' | 'generated';
  libraryId?: string;
  /** Consignes de la séance de bibliothèque, reprises telles quelles. */
  instructions?: string | null;
}

/** Séance de la bibliothèque du coach proposée au générateur (D-062). */
export interface LibrarySession {
  id: string; title: string; category: string; sport: Sport; blocks: Block[]; instructions: string | null;
  /** Bibliothèque Foulée (D-068) : niveaux et phases où la séance a sa place ; absents = sans restriction. */
  levels?: FouleeLevel[]; phases?: FouleePhase[];
}

/** Catégorie de bibliothèque correspondant à chaque type de séance du générateur. */
const LIBRARY_CATEGORY: Record<'tempo' | 'threshold' | 'vma' | 'long', string> = { tempo: 'tempo', threshold: 'threshold', vma: 'intervals', long: 'long' };
const TYPE_REASON: Record<'tempo' | 'threshold' | 'vma' | 'race', string> = {
  tempo: 'première intensité, légère, pour habituer le corps',
  threshold: 'allonger le temps tenu à une allure soutenue',
  vma: 'développer la vitesse maximale aérobie',
  race: 's’habituer à l’allure visée le jour de la course',
};
export interface ProgramWeek { index: number; monday: LocalDate; phase: ProgramPhase; minutes: number; longMinutes: number; sessions: ProgramSession[] }
export type RiskLevel = 'watch' | 'risk' | 'block';
export interface ProgramRisk { level: RiskLevel; text: string }
export interface Program { weeks: ProgramWeek[]; risks: ProgramRisk[]; startWeekly: number; peakWeekly: number; longNeed: number }

export interface ProgramInput {
  feasibility: FeasibilityInput;
  /** Lundi de la première semaine. */
  startMonday: LocalDate;
  /** Jours d’entraînement (1 = lundi … 7 = dimanche), 2 à 6. */
  days: number[];
  /** Volume réellement fait par semaine ces dernières semaines (min), si connu. */
  currentWeeklyMin: number | null;
  refs?: References;
  /** Titre de l’objectif (séance du jour de course). */
  goalTitle: string;
  /** Bibliothèque du coach : ses séances sont choisies en priorité quand elles conviennent (D-062). */
  library?: LibrarySession[];
  /** Bilan (D-066) : jour préféré pour la séance longue (1 = lundi … 7 = dimanche), s’il fait partie des jours choisis. */
  preferredLongDay?: number | null;
  /** Bilan (D-066) : temps disponible pour une séance du lundi au vendredi (min) ; au-delà, le coach est prévenu. */
  weekdayCapMin?: number | null;
}

const STEP = (phase: Step['phase'], measure: Step['measure'], zone: number | null, note: string | null = null): Step => ({
  type: 'step', phase, sport: null, measure, intensity: zone ? { kind: 'zone', zone } : { kind: 'none' }, cadence: null, note,
});
const t = (min: number) => ({ kind: 'time' as const, seconds: Math.max(1, Math.round(min)) * 60 });
const r5 = (min: number) => Math.max(5, Math.round(min / 5) * 5);
const label = (min: number) => (min < 60 ? `${min}′` : formatClock(min * 60));
const growth = (from: number, to: number, steps: number) => (steps > 0 && from > 0 ? Math.pow(to / from, 1 / steps) : 1);

function easyName(sport: Sport): string {
  return sport === 'cycling' ? 'Sortie vélo facile' : sport === 'swimming' ? 'Nage facile' : sport === 'running' || sport === 'trail' ? 'Footing' : 'Endurance';
}

function minutesOf(blocks: Block[], sport: Sport, refs?: References): number {
  return Math.round(structureTotals(blocks, { sport, refs }).seconds / 60);
}

/** Séance de qualité selon le type et la durée visée (échauffement et retour au calme compris). */
function quality(sport: Sport, type: 'tempo' | 'threshold' | 'vma' | 'race', total: number, racePacePerKm: number | null): { title: string; blocks: Block[] } {
  // Séance courte (tremplin) : échauffement et retour au calme raccourcis.
  const short = total < 45;
  const core = Math.max(8, total - (short ? 15 : 25));
  const wu = STEP('warmup', t(short ? 10 : 15), 1), cd = STEP('cooldown', t(short ? 5 : 10), 1);
  if (type === 'tempo') {
    const n = Math.max(short ? 1 : 2, Math.round(core / 10));
    return { title: `Tempo ${n} × 8′`, blocks: [wu, { type: 'repeat', times: n, steps: [STEP('work', t(8), 3), STEP('recovery', t(2), 1)] }, cd] };
  }
  if (type === 'threshold') {
    const n = Math.max(2, Math.round(core / 8));
    return { title: `Seuil ${n} × 6′`, blocks: [wu, { type: 'repeat', times: n, steps: [STEP('work', t(6), 4), STEP('recovery', t(2), 1)] }, cd] };
  }
  if (type === 'race' && racePacePerKm && (sport === 'running' || sport === 'trail')) {
    const n = Math.max(2, Math.round(core / ((2 * racePacePerKm) / 60 + 2)));
    const pace = Math.round(racePacePerKm);
    return {
      title: `Allure course ${n} × 2 km`,
      blocks: [wu, { type: 'repeat', times: n, steps: [{ ...STEP('work', { kind: 'distance', meters: 2000 }, null), intensity: { kind: 'pace', unit: 'per_km', min: pace - 3, max: pace + 3 } }, STEP('recovery', t(2), 1)] }, cd],
    };
  }
  // VMA : en course, des 400 m ; ailleurs, des 3 minutes.
  if (sport === 'running' || sport === 'trail') {
    const n = Math.max(5, Math.min(14, Math.round(core / 3)));
    return { title: `VMA ${n} × 400 m`, blocks: [wu, { type: 'repeat', times: n, steps: [STEP('work', { kind: 'distance', meters: 400 }, 6), STEP('recovery', t(1.5), 1)] }, cd] };
  }
  const n = Math.max(3, Math.round(core / 6));
  return { title: `PMA ${n} × 3′`, blocks: [wu, { type: 'repeat', times: n, steps: [STEP('work', t(3), 6), STEP('recovery', t(3), 1)] }, cd] };
}

const dowOf = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** Jour de la séance longue : celui préféré par l’élève s’il est choisi, sinon le dernier jour du week-end, sinon le dernier de la semaine. */
function longDay(days: number[], preferred?: number | null): number {
  if (preferred && days.includes(preferred)) return preferred;
  return [...days].reverse().find((d) => d >= 6) ?? days[days.length - 1]!;
}

export function generateProgram(input: ProgramInput): Program {
  // Les jours choisis font foi pour le nombre de séances (la faisabilité les juge avec ce rythme).
  const n = new Set(input.days).size;
  const f: FeasibilityInput = { ...input.feasibility, weeklySessions: n >= 6 ? '6plus' : n >= 4 ? '4to5' : n >= 2 ? '2to3' : '0to1', sessionsPerWeek: n };
  const sport = f.sport;
  const days = [...new Set(input.days)].filter((d) => d >= 1 && d <= 7).sort();
  const risks: ProgramRisk[] = [];
  const event = f.eventDate;
  const nWeeks = Math.max(1, Math.floor((Date.parse(`${event}T12:00:00Z`) - Date.parse(`${input.startMonday}T12:00:00Z`)) / (7 * 86_400_000)) + 1);
  const longNeed = longNeeded(f);
  const eventMin = eventMinutes(f);
  const currentLong = currentEndurance(f);
  const sessions = Math.max(1, days.length);
  const easyMin = Math.max(30, Math.min(70, Math.round(longNeed * 0.45)));
  const qualityCount = sessions >= 4 ? 2 : sessions >= 3 ? 1 : sessions >= 2 ? 1 : 0;
  // Volume nécessaire au pic : séance longue + séances de qualité + séances faciles.
  const peakWeekly = longNeed + qualityCount * (easyMin + 10) + Math.max(0, sessions - 1 - qualityCount) * easyMin;
  const startWeekly = Math.max(sessions * 25, input.currentWeeklyMin ?? sessions * Math.min(45, currentLong));

  // Phases : affûtage (2 semaines dès 10, 1 dès 5), tremplin (4 premières), développement ensuite.
  const taper = nWeeks >= 10 ? 2 : nWeeks >= 5 ? 1 : 0;
  const tremplin = Math.min(4, Math.max(0, nWeeks - taper));
  const devWeeks = Math.max(0, nWeeks - taper - tremplin);
  // Fin du tremplin : 80 % du pic si le développement suit, sinon le pic directement.
  const tremplinEnd = devWeeks ? peakWeekly * 0.8 : peakWeekly;
  const longTremplinEnd = devWeeks ? Math.max(currentLong, longNeed * 0.8) : longNeed;
  const gT = growth(startWeekly, tremplinEnd, tremplin);
  const gD = growth(tremplinEnd, peakWeekly, Math.max(1, devWeeks - Math.floor(devWeeks / 4)));
  const lT = growth(currentLong, longTremplinEnd, tremplin);
  const lD = growth(longTremplinEnd, longNeed, Math.max(1, devWeeks - Math.floor(devWeeks / 4)));

  // Risques signalés au coach (il décide).
  const pct = (g: number) => Math.round((g - 1) * 100);
  if (!devWeeks && nWeeks > 1) risks.push({ level: 'risk', text: `Seulement ${nWeeks} semaines : pas de phase de développement, le tremplin mène directement au volume de course.` });
  if (!taper) risks.push({ level: 'watch', text: 'Moins de 5 semaines : pas d’affûtage avant la course.' });
  if (sessions < 2) risks.push({ level: 'block', text: 'Une seule séance par semaine : impossible de construire la séance longue et la qualité.' });
  for (const c of assessGoal(f).criteria) if (c.level === 'risk' || c.level === 'block') risks.push({ level: c.level, text: `Faisabilité · ${c.label} : ${c.text}` });

  const pred = predictionOf(f);
  const racePace = f.targetSeconds ? f.targetSeconds / f.distanceKm : pred ? pred.seconds / f.distanceKm : null;
  const ld = longDay(days, input.preferredLongDay);
  const qualityTypes: ('threshold' | 'vma' | 'race' | 'tempo')[] = f.targetSeconds ? ['threshold', 'race', 'vma'] : ['threshold', 'tempo', 'vma'];
  // Bibliothèque du coach : même sport, même catégorie, durée à ±30 % de la cible ; la moins utilisée d’abord.
  const used = new Map<string, number>();
  const lib = (input.library ?? []).filter((x) => x.blocks.length).map((x) => ({ ...x, minutes: minutesOf(x.blocks, x.sport, input.refs) })).filter((x) => x.minutes > 0);
  const athleteLevel = FOULEE_LEVEL_OF[f.level as keyof typeof FOULEE_LEVEL_OF] ?? 'I';
  const fits = (x: LibrarySession, phase: ProgramPhase) =>
    (!x.levels?.length || x.levels.includes(athleteLevel)) && (!x.phases?.length || x.phases.some((p) => FOULEE_PHASES_OF[phase].includes(p)));
  const pick = (category: string, target: number, phase: ProgramPhase, tolerance = 0.3) => {
    const c = lib.filter((x) => x.sport === sport && x.category === category && fits(x, phase) && Math.abs(x.minutes - target) <= target * tolerance)
      .sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || Math.abs(a.minutes - target) - Math.abs(b.minutes - target))[0];
    if (c) used.set(c.id, (used.get(c.id) ?? 0) + 1);
    return c ?? null;
  };
  const phaseWhy = (p: ProgramPhase) => ({
    tremplin: 'Tremplin', developpement: 'Développement', recuperation: 'Semaine allégée (−25 % pour assimiler)', affutage: 'Affûtage (moins de volume, un rappel d’intensité)',
  })[p];
  const weeks: ProgramWeek[] = [];
  let w = startWeekly, l = currentLong;
  let devIndex = 0, qi = 0;

  for (let i = 0; i < nWeeks; i++) {
    const monday = addDays(input.startMonday, i * 7);
    let phase: ProgramPhase;
    let weekly: number, long: number, nQuality: number;
    if (i < tremplin) {
      phase = 'tremplin';
      w = i === 0 ? startWeekly : w * gT; l = i === 0 ? Math.max(currentLong, Math.min(longTremplinEnd, currentLong * lT)) : l * lT;
      weekly = w; long = l;
      // Tremplin : endurance d’abord, une qualité légère à partir de la 3e semaine.
      nQuality = i >= 2 ? Math.min(1, qualityCount) : 0;
    } else if (i < tremplin + devWeeks) {
      devIndex++;
      if (devIndex % 4 === 0) { phase = 'recuperation'; weekly = w * 0.75; long = l * 0.75; nQuality = Math.min(1, qualityCount); }
      else { phase = 'developpement'; w = Math.min(peakWeekly, w * gD); l = Math.min(longNeed, l * lD); weekly = w; long = l; nQuality = qualityCount; }
    } else {
      phase = 'affutage';
      const last = i === nWeeks - 1;
      weekly = (last ? 0.4 : 0.7) * peakWeekly; long = (last ? 0 : 0.6) * longNeed; nQuality = last ? 1 : Math.min(1, qualityCount);
    }
    // Le pic est atteint à la dernière semaine de développement : le programme est à la hauteur de l’objectif.
    if (phase === 'developpement' && i === tremplin + devWeeks - 1) { weekly = peakWeekly; long = longNeed; w = peakWeekly; l = longNeed; }
    if (phase === 'tremplin' && !devWeeks && i === tremplin - 1) { weekly = peakWeekly; long = longNeed; }

    const list: ProgramSession[] = [];
    const isLast = i === nWeeks - 1;
    const raceDow = ((new Date(`${event}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const weekDays = isLast ? days.filter((d) => d < raceDow) : days;
    const longD = isLast ? null : weekDays.includes(ld) ? ld : weekDays[weekDays.length - 1] ?? null;
    const others = weekDays.filter((d) => d !== longD);
    // Qualités espacées : premiers jours disponibles, jamais la veille de la séance longue si possible.
    const qDays = others.filter((d) => !longD || d !== longD - 1).slice(0, nQuality);
    while (qDays.length < Math.min(nQuality, others.length)) qDays.push(others.find((d) => !qDays.includes(d))!);
    const easyDays = others.filter((d) => !qDays.includes(d));
    const longMin = longD ? r5(long) : 0;
    const easyFloor = phase === 'tremplin' ? 20 : 30;
    // Tremplin : la séance de qualité est dimensionnée pour tenir dans le volume visé de la semaine.
    const room = qDays.length ? (weekly - longMin - Math.max(0, others.length - qDays.length) * easyFloor) / qDays.length : 0;
    const qMin = phase === 'affutage' ? 40
      : phase === 'tremplin' ? r5(Math.max(25, Math.min(45, room)))
      : r5(Math.max(35, Math.min(75, easyMin + 10, room)));
    const qualityMin = qDays.length * qMin;
    // Tremplin : des séances faciles courtes pour partir vraiment de ce que l’élève fait aujourd’hui.
    const easyEach = easyDays.length ? r5(Math.max(easyFloor, (weekly - longMin - qualityMin) / easyDays.length)) : 0;

    for (const d of weekDays.sort()) {
      const date = addDays(monday, d - 1);
      if (d === longD) {
        const why = `${phaseWhy(phase)} : séance longue de ${label(longMin)}, vers les ${label(r5(longNeed))} nécessaires pour la course.`;
        const fromLib = pick(LIBRARY_CATEGORY.long, longMin, phase, 0.15);
        list.push(fromLib
          ? { date, kind: 'long', title: fromLib.title, blocks: fromLib.blocks, minutes: fromLib.minutes, source: 'library', libraryId: fromLib.id, instructions: fromLib.instructions, why: `${why} Choisie dans ta bibliothèque (${fromLib.minutes} min).` }
          : { date, kind: 'long', title: `Sortie longue ${label(longMin)}`, blocks: [STEP('work', t(longMin), 2)], minutes: longMin, source: 'generated', why });
      } else if (qDays.includes(d)) {
        const type = phase === 'tremplin' ? 'tempo' : phase === 'affutage' && f.targetSeconds ? 'race' : qualityTypes[qi++ % qualityTypes.length]!;
        const why = `${phaseWhy(phase)} : ${TYPE_REASON[type]}${type === 'race' && racePace ? ` (${Math.floor(racePace / 60)}:${String(Math.round(racePace % 60)).padStart(2, '0')} /km)` : ''}, environ ${label(qMin)}.`;
        const fromLib = type === 'race' ? null : pick(LIBRARY_CATEGORY[type], qMin, phase);
        if (fromLib) list.push({ date, kind: 'quality', title: fromLib.title, blocks: fromLib.blocks, minutes: fromLib.minutes, source: 'library', libraryId: fromLib.id, instructions: fromLib.instructions, why: `${why} Choisie dans ta bibliothèque (${fromLib.minutes} min pour ${qMin} visées).` });
        else {
          const q = quality(sport, type, qMin, racePace);
          list.push({ date, kind: 'quality', title: q.title, blocks: q.blocks, minutes: minutesOf(q.blocks, sport, input.refs) || qMin, source: 'generated', why });
        }
      } else {
        const why = `${phaseWhy(phase)} : ${phase === 'tremplin' ? 'endurance facile pour installer la régularité depuis ce qui est fait aujourd’hui' : 'endurance facile pour compléter le volume de la semaine'}.`;
        list.push({ date, kind: 'easy', title: `${easyName(sport)} ${label(easyEach)}`, blocks: [STEP('work', t(easyEach), 2)], minutes: easyEach, source: 'generated', why });
      }
    }
    if (isLast) {
      list.push({ date: event, kind: 'race', title: input.goalTitle, blocks: [{ ...STEP('work', { kind: 'distance', meters: Math.round(f.distanceKm * 1000) }, null, 'Jour de course : échauffement léger, départ prudent.') }], minutes: Math.round(eventMin), source: 'generated', why: 'Jour de course : l’objectif validé.' });
    }
    weeks.push({ index: i + 1, monday, phase, minutes: list.reduce((n, s) => n + (s.kind === 'race' ? 0 : s.minutes), 0), longMinutes: longMin, sessions: list });
  }
  // Risques calculés sur les semaines réellement planifiées (D-061) : départ par rapport à ce que l’élève fait,
  // puis hausses d’une semaine à l’autre (hors reprise après une semaine allégée), volume et séance longue.
  const progressionRisks: ProgramRisk[] = [];
  const w1 = weeks[0];
  if (w1 && w1.minutes > startWeekly * 1.1 && input.currentWeeklyMin) {
    const g = w1.minutes / startWeekly;
    progressionRisks.push({ level: g > 1.3 ? 'block' : 'risk', text: `Semaine 1 : ${label(r5(w1.minutes))} prévues pour ${label(r5(startWeekly))} faites en moyenne ces 4 dernières semaines (+${pct(g)} %).` });
  }
  let worst: { week: number; g: number; what: string } | null = null;
  for (let k = 1; k < weeks.length; k++) {
    const prev = weeks[k - 1]!, cur = weeks[k]!;
    if (prev.phase === 'recuperation' || cur.phase === 'affutage') continue;
    const gv = prev.minutes ? cur.minutes / prev.minutes : 1;
    const gl = prev.longMinutes ? cur.longMinutes / prev.longMinutes : 1;
    if (gv > 1.1 && (!worst || gv > worst.g)) worst = { week: cur.index, g: gv, what: 'le volume' };
    if (gl > 1.12 && (!worst || gl > worst.g)) worst = { week: cur.index, g: gl, what: 'la séance longue' };
  }
  if (worst) progressionRisks.push({ level: worst.g > 1.2 ? 'block' : 'risk', text: `Semaine ${worst.week} : ${worst.what} augmente de ${pct(worst.g)} % par rapport à la semaine précédente (10 % conseillés).` });
  // D-066 : séances plus longues que le temps disponible en semaine (bilan). Le coach décide : déplacer ou raccourcir.
  const cap = input.weekdayCapMin;
  if (cap) {
    const over = weeks.flatMap((w) => w.sessions.filter((x) => x.kind !== 'race' && dowOf(x.date) <= 5 && x.minutes > cap).map((x) => ({ w: w.index, x })));
    if (over.length) {
      const top = over.reduce((a, b) => (b.x.minutes > a.x.minutes ? b : a));
      progressionRisks.push({ level: 'watch', text: `Temps en semaine (bilan : ${label(cap)} au plus) : ${over.length} séance${over.length > 1 ? 's' : ''} du lundi au vendredi ${over.length > 1 ? 'le dépassent' : 'le dépasse'}, la plus longue semaine ${top.w} (« ${top.x.title} », ${label(top.x.minutes)}). Déplace-la au week-end ou raccourcis-la.` });
    }
  }
  return { weeks, risks: [...progressionRisks, ...risks], startWeekly: r5(startWeekly), peakWeekly: r5(peakWeekly), longNeed: r5(longNeed) };
}

/** Créer le programme en brouillons (POST …/goals/{gid}/program). Les risques doivent avoir été lus par le coach. */
export const createProgramSchema = z
  .object({
    startMonday: z.string().refine(isLocalDate, { message: 'Date invalide' }),
    days: z.array(z.number().int().min(1).max(7)).min(2, { message: 'Au moins 2 jours' }).max(6, { message: '6 jours au plus' })
      .refine((d) => new Set(d).size === d.length, { message: 'Jour en double' }),
    acceptRisks: z.boolean().default(false),
  })
  .strict();
export type CreateProgramInput = z.output<typeof createProgramSchema>;
