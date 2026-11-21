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
  /** Réglages du coach (D-071), écrits à la main ou proposés par l’IA à partir de sa demande. Le moteur reste seul à construire. */
  tweaks?: ProgramTweaks | null;
}

export const QUALITY_KINDS = ['vma', 'threshold', 'tempo'] as const;
export type QualityKind = (typeof QUALITY_KINDS)[number];
export const QUALITY_KIND_LABELS: Record<QualityKind, string> = { vma: 'VMA / fractionné', threshold: 'seuil', tempo: 'tempo' };
/**
 * Réglages du générateur (D-071). Bornés : ils changent la façon d’atteindre l’objectif, jamais l’objectif lui-même.
 * Un volume réduit ou l’absence de qualité est signalé au coach comme risque.
 */
export const programTweaksSchema = z.object({
  maxQualityPerWeek: z.number().int().min(0).max(2).nullish().transform((v) => v ?? null),
  avoidQuality: z.array(z.enum(QUALITY_KINDS)).max(3).default([]).transform((a) => [...new Set(a)]),
  volumePct: z.number().int().min(70).max(110).nullish().transform((v) => v ?? null),
  longProgressive: z.boolean().default(false),
  longDay: z.number().int().min(1).max(7).nullish().transform((v) => v ?? null),
}).strict();
export type ProgramTweaks = z.output<typeof programTweaksSchema>;
export const NO_TWEAKS: ProgramTweaks = { maxQualityPerWeek: null, avoidQuality: [], volumePct: null, longProgressive: false, longDay: null };
export const hasTweaks = (t: ProgramTweaks | null | undefined) => Boolean(t && (t.maxQualityPerWeek !== null || t.avoidQuality.length || t.volumePct !== null || t.longProgressive || t.longDay));

/** Réglages en français, pour l’écran et pour la trace du programme. */
export function describeTweaks(t: ProgramTweaks, dayLabels: readonly string[]): string[] {
  const out: string[] = [];
  if (t.maxQualityPerWeek !== null) out.push(t.maxQualityPerWeek === 0 ? 'aucune séance de qualité' : `${t.maxQualityPerWeek} séance${t.maxQualityPerWeek > 1 ? 's' : ''} de qualité par semaine au plus`);
  if (t.avoidQuality.length) out.push(`sans ${t.avoidQuality.map((k) => QUALITY_KIND_LABELS[k]).join(' ni ')}`);
  if (t.volumePct !== null && t.volumePct !== 100) out.push(`volume à ${t.volumePct} %`);
  if (t.longProgressive) out.push('sorties longues progressives');
  if (t.longDay) out.push(`séance longue le ${(dayLabels[t.longDay - 1] ?? '').toLowerCase().replace(/\.$/, '')}`);
  return out;
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
  // Allure de course sans allure chiffrée (vélo, natation, ou chrono inconnu) : blocs à l’allure de l’objectif en Z4.
  // Avant D-072, ce cas retombait sur de la VMA / PMA, même quand le coach l’avait écartée.
  if (type === 'race') {
    const n = Math.max(2, Math.round(core / 10));
    return { title: `Allure objectif ${n} × 8′`, blocks: [wu, { type: 'repeat', times: n, steps: [STEP('work', t(8), 4, 'Allure visée le jour de la course'), STEP('recovery', t(2), 1)] }, cd] };
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

// ---------- Méthode du fondateur (D-086, docs/execution/METHODE_FONDATEUR.md) ----------

/** Consignes types, dans le style des programmes du fondateur. */
export const COACH_CUES = {
  easy: 'Facile : tu dois pouvoir parler en phrases complètes. Si une séance saute cette semaine, c’est celle-ci.',
  long: 'Tortue mood : lent du début à la fin, la vitesse ce n’est pas cette séance. Les 10 premières minutes encore plus lentes, c’est ton échauffement.',
  runWalk: 'Cours lentement et marche activement. La marche n’est pas un échec : c’est ce qui permet d’aller au bout sans te blesser. Même si c’est facile, respecte les temps de marche.',
  strides: 'Lignes droites : accélère progressivement jusqu’à aller vite, sans sprinter, en restant relâché. Récupère en trottinant.',
  intervals: 'Pars en dedans sur les 2 ou 3 premières : la première ne peut pas être plus rapide que les suivantes. Mieux vaut finir fort que d’exploser. Prépare la séance sur ta montre.',
  hills: 'Une côte régulière, pas trop raide. Monte en poussant fort, petits pas, buste droit, regard devant ; la descente sert de récupération.',
  pace: 'Mémorise l’allure du jour J : régulière, ni plus vite ni plus lente.',
  test: 'Pars prudent les 2 premiers km, accélère à partir de la moitié si tu peux et donne tout sur le dernier. Note ton chrono et ton parcours : il cale tes allures.',
  taper: 'Moins de volume, un peu de rythme pour garder les jambes vives.',
  eve: 'Veille de course : juste de quoi se mettre en confiance, ça ne changera plus rien à la course.',
  stop: 'Douleur qui reste et augmente en courant : tu coupes la séance et tu me préviens.',
} as const;

/** Course/marche : portions de course de la semaine (min), de 1′ jusqu’à 20′ d’une traite. */
const RUN_PORTIONS = [1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20];
const mm = (min: number) => (Number.isInteger(min) ? `${min}′` : `${Math.floor(min)}′${String(Math.round((min % 1) * 60)).padStart(2, '0')}`);
function runWalkSession(target: number, run: number): { title: string; blocks: Block[]; minutes: number } {
  const walk = run < 4 ? 1.5 : run <= 10 ? 1 : 2;
  const wu = run <= 3 ? 10 : 5;
  const n = Math.max(2, Math.min(20, Math.round((target - wu) / (run + walk))));
  const sec = (m: number) => ({ kind: 'time' as const, seconds: Math.round(m * 60) });
  return {
    title: `Course/marche ${n} × (${mm(run)} + ${mm(walk)} marche)`,
    blocks: [STEP('warmup', sec(wu), null, 'marche active'), { type: 'repeat', times: n, steps: [STEP('work', sec(run), 2), STEP('recovery', sec(walk), null, 'marche')] }],
    minutes: Math.round(wu + n * (run + walk)),
  };
}

/** Lignes droites en fin de footing : 4 à 8 × (20″ + R40″), sans zone (ce n’est pas une séance de qualité). */
function stridesBlock(n: number, work = 20, rec = 40): Block {
  return { type: 'repeat', times: n, steps: [STEP('work', { kind: 'time', seconds: work }, null, 'accélération progressive'), STEP('recovery', { kind: 'time', seconds: rec }, null, 'en trottinant')] };
}

/** Séances de qualité de la course à pied, du court au long, comme dans les programmes du fondateur. */
type ProgKey = 's200' | 'hills' | 'pyramid' | 's400' | 'k1' | 'k2' | 'pace' | 'race';
const PROG: Record<ProgKey, { kind: QualityKind | 'race'; category: string; reason: string; cue: string }> = {
  s200: { kind: 'vma', category: 'intervals', reason: 'premier fractionné, sur des distances courtes', cue: COACH_CUES.intervals },
  hills: { kind: 'vma', category: 'hills', reason: 'côtes : du renforcement déguisé, pour la force et la foulée', cue: COACH_CUES.hills },
  pyramid: { kind: 'vma', category: 'intervals', reason: 'pyramide : tenir la même allure sur des efforts qui changent', cue: COACH_CUES.intervals },
  s400: { kind: 'vma', category: 'intervals', reason: 'les fractions s’allongent', cue: COACH_CUES.intervals },
  k1: { kind: 'vma', category: 'intervals', reason: 'fractions longues, vers l’allure de course', cue: COACH_CUES.intervals },
  k2: { kind: 'threshold', category: 'threshold', reason: 'fractions longues pour tenir l’allure longtemps', cue: COACH_CUES.intervals },
  pace: { kind: 'tempo', category: 'tempo', reason: 's’habituer à l’allure visée le jour de la course', cue: COACH_CUES.pace },
  race: { kind: 'race', category: 'race', reason: 's’habituer à l’allure visée le jour de la course', cue: COACH_CUES.pace },
};
const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
// D-087 : zones de l’échelle mêlée (200 et 400 m = VMA Z6 ; 1 km et pyramide = allure 5 km Z5 ; 2 km = seuil Z4).
function progSession(key: ProgKey, total: number, racePace: number | null, paceZone = 4): { title: string; blocks: Block[] } {
  const short = total < 45;
  const core = Math.max(8, total - (short ? 15 : 25));
  const wu = STEP('warmup', t(short ? 10 : 15), 1), cd = STEP('cooldown', t(short ? 5 : 10), 1);
  const rep = (n: number, steps: Step[]): Block => ({ type: 'repeat', times: n, steps });
  const dist = (m: number) => ({ kind: 'distance' as const, meters: m });
  switch (key) {
    case 's200': { const n = clampN(core / 2.2, 6, 12); return { title: `Fractionné ${n} × 200 m`, blocks: [wu, rep(n, [STEP('work', dist(200), 6), STEP('recovery', dist(200), null)]), cd] }; }
    case 'hills': { const n = clampN(core / 1.5, 6, 12); return { title: `Côtes ${n} × 30″`, blocks: [wu, rep(n, [STEP('work', { kind: 'time', seconds: 30 }, 6, 'en côte'), STEP('recovery', t(1), null, 'descente en trottinant')]), cd] }; }
    case 'pyramid': {
      const parts = [1, 2, 3, 2, 1];
      const steps: Block[] = parts.flatMap((m, i) => [STEP('work', t(m), 5), ...(i < parts.length - 1 ? [STEP('recovery', t(1), null)] : [])]);
      return { title: 'Pyramide 1-2-3-2-1′', blocks: [wu, ...steps, cd] };
    }
    case 's400': { const n = clampN(core / 3.5, 5, 10); return { title: `Fractionné ${n} × 400 m`, blocks: [wu, rep(n, [STEP('work', dist(400), 6), STEP('recovery', dist(200), null)]), cd] }; }
    case 'k1': { const n = clampN(core / 6.5, 3, 6); return { title: `Fractionné ${n} × 1 km`, blocks: [wu, rep(n, [STEP('work', dist(1000), 5), STEP('recovery', t(n >= 5 ? 1.5 : 2), null)]), cd] }; }
    case 'k2': { const n = clampN(core / 11, 2, 5); return { title: `Fractionné long ${n} × 2 km`, blocks: [wu, rep(n, [STEP('work', dist(2000), 4), STEP('recovery', t(3), null)]), cd] }; }
    case 'pace': { const n = clampN(core / 12, 2, 4); return { title: `Allure course ${n} × 10′`, blocks: [wu, rep(n, [STEP('work', t(10), paceZone, 'allure visée le jour de la course'), STEP('recovery', t(2), null)]), cd] }; }
    case 'race': return quality('running', 'race', total, racePace);
  }
}
/** Rappel d’allure de la dernière semaine : 15′ + 4 × (3′ allure + R1′) + 10′. */
function paceReminder(racePace: number | null, paceZone = 4): { title: string; blocks: Block[] } {
  const work: Step = racePace
    ? { ...STEP('work', t(3), null), intensity: { kind: 'pace', unit: 'per_km', min: Math.round(racePace) - 3, max: Math.round(racePace) + 3 } }
    : STEP('work', t(3), paceZone, 'allure visée le jour de la course');
  return { title: 'Rappel d’allure 4 × 3′', blocks: [STEP('warmup', t(15), 1), { type: 'repeat', times: 4, steps: [work, STEP('recovery', t(1), null)] }, STEP('cooldown', t(10), 1)] };
}

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
  // D-107 (méthode du fondateur) : quand le développement suit, le tremplin fait 3 semaines qui montent, puis une
  // petite semaine de décharge avant le premier bloc de développement.
  const deloadAt = tremplin === 4 && devWeeks > 0 ? 3 : -1;
  const tremplinRise = deloadAt >= 0 ? 3 : tremplin;
  // Fin du tremplin : 80 % du pic si le développement suit, sinon le pic directement.
  const tremplinEnd = devWeeks ? peakWeekly * 0.8 : peakWeekly;
  const longTremplinEnd = devWeeks ? Math.max(currentLong, longNeed * 0.8) : longNeed;
  const gT = growth(startWeekly, tremplinEnd, tremplinRise);
  const gD = growth(tremplinEnd, peakWeekly, Math.max(1, devWeeks - Math.floor(devWeeks / 4)));
  const lT = growth(currentLong, longTremplinEnd, tremplinRise);
  const lD = growth(longTremplinEnd, longNeed, Math.max(1, devWeeks - Math.floor(devWeeks / 4)));

  // Risques signalés au coach (il décide).
  const pct = (g: number) => Math.round((g - 1) * 100);
  if (!devWeeks && nWeeks > 1) risks.push({ level: 'risk', text: `Seulement ${nWeeks} semaines : pas de phase de développement, le tremplin mène directement au volume de course.` });
  if (!taper) risks.push({ level: 'watch', text: 'Moins de 5 semaines : pas d’affûtage avant la course.' });
  if (sessions < 2) risks.push({ level: 'block', text: 'Une seule séance par semaine : impossible de construire la séance longue et la qualité.' });
  for (const c of assessGoal(f).criteria) if (c.level === 'risk' || c.level === 'block') risks.push({ level: c.level, text: `Faisabilité · ${c.label} : ${c.text}` });

  const pred = predictionOf(f);
  const racePace = f.targetSeconds ? f.targetSeconds / f.distanceKm : pred ? pred.seconds / f.distanceKm : null;
  const tw = input.tweaks ?? NO_TWEAKS;
  const ld = longDay(days, tw.longDay ?? input.preferredLongDay);
  const avoid = new Set<string>(tw.avoidQuality);
  const baseTypes: ('threshold' | 'vma' | 'race' | 'tempo')[] = f.targetSeconds ? ['threshold', 'race', 'vma'] : ['threshold', 'tempo', 'vma'];
  // D-071 : types évités par le coach ; s’il les écarte tous, l’allure de course (ou le tempo) reste.
  const kept = baseTypes.filter((x) => !avoid.has(x));
  const qualityTypes = kept.length ? kept : [f.targetSeconds ? 'race' as const : 'tempo' as const];
  const tremplinType: 'tempo' | 'threshold' | 'race' = !avoid.has('tempo') ? 'tempo' : !avoid.has('threshold') ? 'threshold' : 'race';
  const volume = (tw.volumePct ?? 100) / 100;
  if (tw.volumePct !== null && tw.volumePct < 100) risks.push({ level: 'risk', text: `Volume réglé à ${tw.volumePct} % de ce que demande l’objectif (séance longue gardée) : marge plus faible le jour de la course.` });
  if (tw.maxQualityPerWeek === 0) risks.push({ level: 'watch', text: 'Aucune séance de qualité : l’allure visée n’est pas travaillée avant la course.' });
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
    tremplin: 'Tremplin', developpement: 'Développement', recuperation: 'Semaine allégée (moins de volume pour assimiler)', affutage: 'Affûtage (moins de volume, un rappel d’intensité)',
  })[p];
  // D-086 : méthode du fondateur pour la course à pied.
  const isRun = sport === 'running' || sport === 'trail';
  // Course/marche tant que l’élève ne court pas 20′ d’une traite ; la portion de course monte chaque semaine.
  // Débutant ou longue coupure : on repart d’1′ de course, comme le fondateur.
  const rwStart = f.practiceStatus === 'beginner' || f.practiceStatus === 'stopped' || currentLong < 5 ? 0 : currentLong < 10 ? 1 : currentLong < 15 ? 2 : 3;
  const runPortion = (i: number, isLong: boolean) => (isRun && currentLong < 20 ? RUN_PORTIONS[Math.min(RUN_PORTIONS.length - 1, rwStart + Math.floor(i * 1.5) + (isLong ? 1 : 0))]! : 20);
  const runWalkWeek = (i: number) => runPortion(i, false) < 20;
  // Qualité du court au long, puis rotation vers l’allure de course ; types écartés par le coach respectés.
  const chrono = Boolean(f.targetSeconds && racePace);
  const rotation: ProgKey[] = f.distanceKm >= 15 ? [chrono ? 'race' : 'pace', 'k2', 'k1', 's400'] : [chrono ? 'race' : 'pace', 'k1', 's400'];
  const allowed = (k: ProgKey) => PROG[k].kind === 'race' || !avoid.has(PROG[k].kind);
  const firstSteps = (['s200', 'hills', 'pyramid', 's400', 'k1'] as ProgKey[]).filter(allowed);
  const cycle = rotation.filter(allowed).length ? rotation.filter(allowed) : [chrono ? 'race' as const : 'pace' as const];
  let pi = 0;
  const nextProg = (): ProgKey => (pi < firstSteps.length ? firstSteps[pi++]! : cycle[(pi++ - firstSteps.length) % cycle.length]!);
  const paceKey: ProgKey = chrono ? 'race' : allowed('pace') ? 'pace' : cycle[0]!;
  // Test 5 km en semaine 3 (après les premières semaines faciles) pour caler les allures : course jusqu’au semi.
  const testWeek = isRun && f.distanceKm <= 21.1 && nWeeks >= 8 && tremplin >= 3 && currentLong >= 30 && !runWalkWeek(2) ? 2 : -1;
  const estPerKm = eventMin / f.distanceKm;
  // Allure de course sans chrono : seuil (Z4) jusqu’au semi, endurance active (Z3) au-delà.
  const paceZone = f.distanceKm >= 30 ? 3 : 4;

  const weeks: ProgramWeek[] = [];
  let w = startWeekly, l = currentLong;
  let devIndex = 0, qi = 0;

  for (let i = 0; i < nWeeks; i++) {
    const monday = addDays(input.startMonday, i * 7);
    let phase: ProgramPhase;
    let weekly: number, long: number, nQuality: number;
    if (i === deloadAt) {
      // Décharge : environ −20 % de volume, séance longue un peu raccourcie ; le développement repart du niveau de S3.
      phase = 'recuperation'; weekly = w * 0.8; long = l * 0.85; nQuality = 0;
    } else if (i < tremplin) {
      phase = 'tremplin';
      w = i === 0 ? startWeekly : w * gT; l = i === 0 ? Math.max(currentLong, Math.min(longTremplinEnd, currentLong * lT)) : l * lT;
      weekly = w; long = l;
      // Tremplin : endurance d’abord, une qualité légère à partir de la 3e semaine (pas en course/marche ni la semaine du test).
      nQuality = i >= 2 && !runWalkWeek(i) && i !== testWeek ? Math.min(1, qualityCount) : 0;
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
    // D-071 : réglages du coach. Le volume s’applique aux séances autres que la longue, qui reste à la hauteur de l’objectif.
    if (tw.maxQualityPerWeek !== null) nQuality = Math.min(nQuality, tw.maxQualityPerWeek);
    if (runWalkWeek(i) && phase !== 'affutage') nQuality = 0;
    if (volume !== 1) weekly = Math.max(long + 20, weekly * volume);

    const list: ProgramSession[] = [];
    const isLast = i === nWeeks - 1;
    const raceDow = ((new Date(`${event}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const weekDays = isLast ? days.filter((d) => d < raceDow) : days;
    const longD = isLast ? null : weekDays.includes(ld) ? ld : weekDays[weekDays.length - 1] ?? null;
    const others = weekDays.filter((d) => d !== longD);
    // Qualités espacées : premiers jours disponibles, jamais la veille de la séance longue si possible.
    // Fondateur : jamais une séance de qualité la veille ni le lendemain de la séance longue.
    const qDays = others.filter((d) => !longD || (d !== longD - 1 && d !== longD + 1)).slice(0, nQuality);
    while (qDays.length < Math.min(nQuality, others.length)) qDays.push(others.find((d) => !qDays.includes(d))!);
    const easyDays = others.filter((d) => !qDays.includes(d));
    const longMin = longD ? r5(long) : 0;
    const easyFloor = phase === 'tremplin' || i === deloadAt ? 20 : 30;
    // Tremplin : la séance de qualité est dimensionnée pour tenir dans le volume visé de la semaine.
    const room = qDays.length ? (weekly - longMin - Math.max(0, others.length - qDays.length) * easyFloor) / qDays.length : 0;
    const qMin = phase === 'affutage' ? 40
      : phase === 'tremplin' ? r5(Math.max(25, Math.min(45, room)))
      : r5(Math.max(35, Math.min(75, easyMin + 10, room)));
    const qualityMin = qDays.length * qMin;
    // Tremplin : des séances faciles courtes pour partir vraiment de ce que l’élève fait aujourd’hui.
    const easyEach = easyDays.length ? r5(Math.max(easyFloor, (weekly - longMin - qualityMin) / easyDays.length)) : 0;

    const fmtPace = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')} /km`;
    const firstEasy = weekDays.filter((d) => d !== longD && !qDays.includes(d))[0];
    const eve = isLast ? raceDow - 1 : null;
    let weekQ = 0;
    for (const d of weekDays.sort()) {
      const date = addDays(monday, d - 1);
      // D-086 : course/marche tant que l’élève ne court pas 20′ d’une traite.
      const rw = (target: number, isLong: boolean) => {
        const run = runPortion(i, isLong);
        return run < 20 ? runWalkSession(target, run) : null;
      };
      if (d === longD && i === testWeek) {
        const minutes = r5(15 + 5 * estPerKm);
        list.push({ date, kind: 'quality', title: 'Test 5 km', minutes, source: 'generated', instructions: COACH_CUES.test,
          blocks: [STEP('warmup', t(10), 1), STEP('work', { kind: 'distance', meters: 5000 }, null, 'le plus vite possible en restant régulier'), STEP('cooldown', t(5), 1)],
          why: `${phaseWhy(phase)} : test 5 km pour caler tes allures de la suite du programme, à la place de la séance longue cette semaine.` });
      } else if (d === longD) {
        const why = `${phaseWhy(phase)} : séance longue de ${label(longMin)}, vers les ${label(r5(longNeed))} nécessaires pour la course.`;
        // En course/marche, la sortie du week-end reste la plus longue de la semaine.
        const walk = rw(Math.max(longMin, easyEach + 5), true);
        const fromLib = tw.longProgressive || walk ? null : pick(LIBRARY_CATEGORY.long, longMin, phase, 0.15);
        const prog = tw.longProgressive && longMin >= 40 && !walk ? r5(longMin / 3) : 0;
        if (walk) list.push({ date, kind: 'long', title: walk.title, blocks: walk.blocks, minutes: walk.minutes, source: 'generated', instructions: COACH_CUES.runWalk, why: `${why} En course/marche : la portion de course s’allonge chaque semaine.` });
        else if (prog) list.push({ date, kind: 'long', title: `Sortie longue progressive ${label(longMin)}`, blocks: [STEP('work', t(longMin - prog), 2), STEP('work', t(prog), 3)], minutes: longMin, source: 'generated', instructions: isRun ? `${COACH_CUES.long}\n\n${COACH_CUES.stop}` : null, why: `${why} Progressive à ta demande : le dernier tiers un cran plus vite.` });
        else list.push(fromLib
          ? { date, kind: 'long', title: fromLib.title, blocks: fromLib.blocks, minutes: fromLib.minutes, source: 'library', libraryId: fromLib.id, instructions: fromLib.instructions, why: `${why} Choisie dans ta bibliothèque (${fromLib.minutes} min).` }
          : { date, kind: 'long', title: `Sortie longue ${label(longMin)}`, blocks: [STEP('work', t(longMin), 2)], minutes: longMin, source: 'generated', instructions: isRun ? `${COACH_CUES.long}\n\n${COACH_CUES.stop}` : null, why });
      } else if (qDays.includes(d) && isRun) {
        // Dernière semaine : un rappel d’allure, tôt dans la semaine.
        if (isLast) {
          const q = paceReminder(racePace, paceZone);
          list.push({ date, kind: 'quality', title: q.title, blocks: q.blocks, minutes: minutesOf(q.blocks, sport, input.refs) || 40, source: 'generated', instructions: `${COACH_CUES.taper} ${COACH_CUES.pace}`,
            why: `${phaseWhy(phase)} : rappel de l’allure de course${racePace ? ` (${fmtPace(racePace)})` : ''}, au plus tard trois jours avant.` });
          weekQ++;
          continue;
        }
        let key: ProgKey = weekQ === 1 ? paceKey : phase === 'affutage' && chrono ? 'race' : nextProg();
        // Deux séances de qualité : vitesse puis allure, jamais deux fois l’allure la même semaine.
        if (weekQ === 0 && qDays.length >= 2 && key === paceKey && cycle.length > 1) key = nextProg();
        weekQ++;
        const item = PROG[key];
        const why = `${phaseWhy(phase)} : ${item.reason}${key === 'race' && racePace ? ` (${fmtPace(racePace)})` : ''}, environ ${label(qMin)}.`;
        const fromLib = key === 'race' ? null : pick(item.category, qMin, phase);
        if (fromLib) list.push({ date, kind: 'quality', title: fromLib.title, blocks: fromLib.blocks, minutes: fromLib.minutes, source: 'library', libraryId: fromLib.id, instructions: fromLib.instructions, why: `${why} Choisie dans ta bibliothèque (${fromLib.minutes} min pour ${qMin} visées).` });
        else {
          const q = progSession(key, qMin, racePace, paceZone);
          // Sans VMA connue, les fractions en distance ne se chiffrent pas : la durée visée sert d’estimation.
          list.push({ date, kind: 'quality', title: q.title, blocks: q.blocks, minutes: input.refs?.vmaKmh ? minutesOf(q.blocks, sport, input.refs) || qMin : qMin, source: 'generated', instructions: `${item.cue}\n\n${COACH_CUES.stop}`, why });
        }
      } else if (qDays.includes(d)) {
        const type = phase === 'tremplin' ? tremplinType : phase === 'affutage' && f.targetSeconds ? 'race' : qualityTypes[qi++ % qualityTypes.length]!;
        const why = `${phaseWhy(phase)} : ${TYPE_REASON[type]}${type === 'race' && racePace ? ` (${Math.floor(racePace / 60)}:${String(Math.round(racePace % 60)).padStart(2, '0')} /km)` : ''}, environ ${label(qMin)}.`;
        const fromLib = type === 'race' ? null : pick(LIBRARY_CATEGORY[type], qMin, phase);
        if (fromLib) list.push({ date, kind: 'quality', title: fromLib.title, blocks: fromLib.blocks, minutes: fromLib.minutes, source: 'library', libraryId: fromLib.id, instructions: fromLib.instructions, why: `${why} Choisie dans ta bibliothèque (${fromLib.minutes} min pour ${qMin} visées).` });
        else {
          const q = quality(sport, type, qMin, racePace);
          list.push({ date, kind: 'quality', title: q.title, blocks: q.blocks, minutes: minutesOf(q.blocks, sport, input.refs) || qMin, source: 'generated', why });
        }
      } else if (isRun && d === eve) {
        // Veille de course : 15′ et quelques lignes droites.
        list.push({ date, kind: 'easy', title: 'Footing 15′ + lignes droites', blocks: [STEP('work', t(15), 2), stridesBlock(4, 30, 30)], minutes: 19, source: 'generated', instructions: `${COACH_CUES.eve} ${COACH_CUES.strides}`,
          why: `${phaseWhy(phase)} : veille de course, pour se mettre en confiance.` });
      } else {
        const why = `${phaseWhy(phase)} : ${phase === 'tremplin' ? 'endurance facile pour installer la régularité depuis ce qui est fait aujourd’hui' : 'endurance facile pour compléter le volume de la semaine'}.`;
        const walk = rw(easyEach, false);
        // Lignes droites : premier contact avec la vitesse, en fin de footing, les semaines sans qualité (avant le premier fractionné).
        const strides = isRun && !walk && d === firstEasy && nQuality === 0 && phase === 'tremplin';
        if (walk) list.push({ date, kind: 'easy', title: walk.title, blocks: walk.blocks, minutes: walk.minutes, source: 'generated', instructions: COACH_CUES.runWalk, why: `${why} En course/marche, pour habituer le corps aux impacts.` });
        else if (strides) list.push({ date, kind: 'easy', title: `${easyName(sport)} ${label(easyEach)} + lignes droites`, blocks: [STEP('work', t(easyEach), 2), stridesBlock(i === 0 ? 4 : 6)], minutes: easyEach + (i === 0 ? 4 : 6), source: 'generated',
          instructions: `${COACH_CUES.easy}\n\n${COACH_CUES.strides}`, why: `${why} Avec des lignes droites : premier contact avec la vitesse, avant le fractionné.` });
        else list.push({ date, kind: 'easy', title: `${easyName(sport)} ${label(easyEach)}`, blocks: [STEP('work', t(easyEach), 2)], minutes: easyEach, source: 'generated', instructions: isRun ? COACH_CUES.easy : null, why });
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
  // D-086 : seuils en minutes aussi (pratique du fondateur : +15 à 30′ par semaine aux petits volumes sans souci).
  if (w1 && w1.minutes > startWeekly * 1.1 && w1.minutes - startWeekly > 20 && input.currentWeeklyMin) {
    const g = w1.minutes / startWeekly;
    progressionRisks.push({ level: g > 1.3 && w1.minutes - startWeekly > 45 ? 'block' : 'risk', text: `Semaine 1 : ${label(r5(w1.minutes))} prévues pour ${label(r5(startWeekly))} faites en moyenne ces 4 dernières semaines (+${pct(g)} %).` });
  }
  let worst: { week: number; g: number; what: string; delta: number; block: boolean } | null = null;
  for (let k = 1; k < weeks.length; k++) {
    const prev = weeks[k - 1]!, cur = weeks[k]!;
    if (prev.phase === 'recuperation' || cur.phase === 'affutage') continue;
    const gv = prev.minutes ? cur.minutes / prev.minutes : 1, dv = cur.minutes - prev.minutes;
    const gl = prev.longMinutes ? cur.longMinutes / prev.longMinutes : 1, dl = cur.longMinutes - prev.longMinutes;
    // Volume : risque au-delà de +10 % et de +30′ ; séance longue : au-delà de +12 % et de +10′.
    if (gv > 1.1 && dv > 30 && (!worst || gv > worst.g)) worst = { week: cur.index, g: gv, what: 'le volume', delta: dv, block: gv > 1.3 && dv > 45 };
    if (gl > 1.12 && dl > 10 && (!worst || gl > worst.g)) worst = { week: cur.index, g: gl, what: 'la séance longue', delta: dl, block: gl > 1.3 && dl > 20 };
  }
  if (worst) progressionRisks.push({ level: worst.block ? 'block' : 'risk', text: `Semaine ${worst.week} : ${worst.what} augmente de ${pct(worst.g)} % (+${Math.round(worst.delta)}′) par rapport à la semaine précédente.` });
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
    /** D-071 : réglages (à la main ou proposés par l’IA) et proposition IA appliquée, pour la trace. */
    tweaks: programTweaksSchema.nullish().transform((v) => v ?? null),
    suggestionId: z.string().uuid().nullish().transform((v) => v ?? null),
  })
  .strict();
export type CreateProgramInput = z.output<typeof createProgramSchema>;
