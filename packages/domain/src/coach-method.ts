import { z } from 'zod';
import { LEVELS, type Level } from './athlete-profile';
import { NO_TWEAKS, programTweaksSchema, QUALITY_KINDS, QUALITY_KIND_LABELS, type ProgramTweaks, type QualityKind } from './program';
import type { Sport } from './sports';
import { structureTotals, type Block, type Step } from './structure';
import { SPORTS } from './workout';

/**
 * Méthode du coach (Coach DNA, docs/09_COACH_DNA.md, D-072). Profil versionné par coach et par espace :
 * philosophie et style (lecture seule pour l’instant), et règles typées, sans texte exécutable, que le générateur
 * applique par défaut à tous les élèves du coach. Les réglages faits pour un programme précis restent prioritaires.
 * Les règles peuvent être apprises des corrections du coach : candidates proposées, jamais appliquées sans lui.
 */

export const METHOD_STYLES = ['direct', 'encourageant', 'pedagogique'] as const;
export type MethodStyle = (typeof METHOD_STYLES)[number];
export const METHOD_STYLE_LABELS: Record<MethodStyle, string> = { direct: 'Direct', encourageant: 'Encourageant', pedagogique: 'Pédagogique' };

const scopeSchema = z.object({
  level: z.enum(LEVELS).nullish().transform((v) => v ?? null),
  sport: z.enum(SPORTS).nullish().transform((v) => v ?? null),
}).strict();
const base = {
  id: z.string().uuid(),
  scope: scopeSchema,
  source: z.enum(['manual', 'learned']),
  /** Règle apprise : observations qui l’ont fait proposer, au moment de l’acceptation. */
  support: z.number().int().min(0).max(10_000).nullish().transform((v) => v ?? null),
};
export const methodRuleSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('avoid_quality'), quality: z.enum(QUALITY_KINDS) }).strict(),
  z.object({ ...base, kind: z.literal('max_quality'), n: z.number().int().min(0).max(2) }).strict(),
  z.object({ ...base, kind: z.literal('volume_pct'), pct: z.number().int().min(70).max(110) }).strict(),
  z.object({ ...base, kind: z.literal('long_day'), day: z.number().int().min(1).max(7) }).strict(),
  z.object({ ...base, kind: z.literal('long_progressive') }).strict(),
]);
export type MethodRule = z.output<typeof methodRuleSchema>;
export type MethodRuleKind = MethodRule['kind'];

export const coachMethodSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  philosophy: z.string().trim().max(500, { message: '500 caractères au plus' }).nullish().transform((v) => (v ? v : null)),
  style: z.enum(METHOD_STYLES).nullish().transform((v) => v ?? null),
  rules: z.array(methodRuleSchema).max(20, { message: '20 règles au plus' }).default([]),
  /** Propositions écartées par le coach (clé de candidate) : elles ne reviennent pas. */
  dismissed: z.array(z.string().max(60)).max(200).default([]),
}).strict();
export type CoachMethod = z.output<typeof coachMethodSchema>;
export const EMPTY_METHOD: CoachMethod = { schemaVersion: 1, philosophy: null, style: null, rules: [], dismissed: [] };

export const saveMethodSchema = z.object({ expectedVersion: z.number().int().min(0), method: coachMethodSchema, reason: z.string().max(120).nullish().transform((v) => v ?? null) }).strict();

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const LEVEL_WORDS: Record<Level, string> = { beginner: 'débutants', intermediate: 'intermédiaires', advanced: 'avancés', competitive: 'compétiteurs' };

/** La règle en français, avec sa portée. */
export function ruleLabel(r: MethodRule): string {
  const what = r.kind === 'avoid_quality' ? `pas de séance de ${QUALITY_KIND_LABELS[r.quality]}`
    : r.kind === 'max_quality' ? (r.n === 0 ? 'aucune séance de qualité' : `${r.n} séance${r.n > 1 ? 's' : ''} de qualité par semaine au plus`)
      : r.kind === 'volume_pct' ? `volume à ${r.pct} % (séance longue gardée)`
        : r.kind === 'long_day' ? `sortie longue le ${DAYS[r.day - 1]}`
          : 'sorties longues progressives';
  const who = [r.scope.level ? `pour les ${LEVEL_WORDS[r.scope.level]}` : null, r.scope.sport ? `en ${r.scope.sport === 'running' ? 'course à pied' : r.scope.sport}` : null].filter(Boolean).join(' ');
  return who ? `${what}, ${who}` : what;
}

const applies = (r: MethodRule, a: { level: Level | null; sport: Sport | null }) =>
  (!r.scope.level || r.scope.level === a.level) && (!r.scope.sport || r.scope.sport === a.sport);
const specificity = (r: MethodRule) => (r.scope.level ? 2 : 0) + (r.scope.sport ? 1 : 0);

/** Réglages par défaut d’un élève selon la méthode : la règle la plus précise l’emporte ; les types évités s’additionnent. */
export function methodTweaksFor(rules: MethodRule[], athlete: { level: Level | null; sport: Sport | null }): ProgramTweaks {
  const t: ProgramTweaks = { ...NO_TWEAKS, avoidQuality: [] };
  const best = new Map<string, MethodRule>();
  for (const r of rules.filter((x) => applies(x, athlete))) {
    if (r.kind === 'avoid_quality') { if (!t.avoidQuality.includes(r.quality)) t.avoidQuality.push(r.quality); continue; }
    if (r.kind === 'long_progressive') { t.longProgressive = true; continue; }
    const cur = best.get(r.kind);
    if (!cur || specificity(r) > specificity(cur)) best.set(r.kind, r);
  }
  for (const r of best.values()) {
    if (r.kind === 'max_quality') t.maxQualityPerWeek = r.n;
    if (r.kind === 'volume_pct') t.volumePct = r.pct;
    if (r.kind === 'long_day') t.longDay = r.day;
  }
  return programTweaksSchema.parse(t);
}

/** Réglages effectifs : ceux du programme (IA ou à la main) priment sur la méthode ; les types évités s’additionnent. */
export function mergeTweaks(method: ProgramTweaks | null, program: ProgramTweaks | null): ProgramTweaks | null {
  if (!method) return program;
  if (!program) return method;
  return programTweaksSchema.parse({
    maxQualityPerWeek: program.maxQualityPerWeek ?? method.maxQualityPerWeek,
    avoidQuality: [...new Set([...method.avoidQuality, ...program.avoidQuality])],
    volumePct: program.volumePct ?? method.volumePct,
    longProgressive: program.longProgressive || method.longProgressive,
    longDay: program.longDay ?? method.longDay,
  });
}

// ---------- Apprendre des corrections ----------

/** Seuils de docs/09 (internes et calibrables). */
export const LEARNING = { windowDays: 90, minSupport: 5, minWeeks: 2, minConcordance: 0.8 } as const;

function walk(blocks: Block[], f: (s: Step) => void) {
  for (const b of blocks) {
    if (b.type === 'repeat') for (const s of b.steps) { if (s.type === 'step') f(s); else walk([s] as Block[], f); }
    else f(b as Step);
  }
}
/** Ce qu’est une séance, d’après son titre et ses blocs : sortie longue, type de qualité, intensité, durée. */
export function sessionTraits(title: string, blocks: Block[]): { long: boolean; quality: QualityKind | null; maxZone: number; minutes: number; progressive: boolean } {
  let maxZone = 0;
  walk(blocks, (s) => { if (s.intensity.kind === 'zone') maxZone = Math.max(maxZone, s.intensity.zone); });
  const long = /sortie longue/i.test(title);
  const quality: QualityKind | null = long ? null : maxZone >= 5 ? 'vma' : maxZone === 4 ? 'threshold' : maxZone === 3 && !/footing|endurance/i.test(title) ? 'tempo' : null;
  return { long, quality, maxZone, minutes: Math.round(structureTotals(blocks).seconds / 60), progressive: long && /progressi/i.test(title) };
}

const dow = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

export interface MethodEvidence { key: string; athleteId: string; week: string; level: Level | null; sport: Sport | null; value?: number }

/**
 * Une séance générée retouchée par le coach → observations : sortie longue déplacée, qualité retirée ou adoucie,
 * séance facile raccourcie, sortie longue rendue progressive. Une séance générée publiée telle quelle → contre-exemples.
 */
export function observeEdit(gen: { date: string; title: string; blocks: Block[] }, cur: { date: string; title: string; blocks: Block[]; canceled: boolean }): { key: string; value?: number }[] {
  const g = sessionTraits(gen.title, gen.blocks);
  const c = sessionTraits(cur.title, cur.blocks);
  const out: { key: string; value?: number }[] = [];
  if (g.long && !cur.canceled && cur.date !== gen.date) out.push({ key: `long_day:${dow(cur.date)}` });
  if (g.quality && (cur.canceled || (c.quality !== g.quality && c.maxZone < g.maxZone))) out.push({ key: `avoid_quality:${g.quality}` });
  if (!g.long && !g.quality && !cur.canceled && g.minutes > 0 && c.minutes > 0 && c.minutes <= g.minutes * 0.9) out.push({ key: 'volume_pct', value: c.minutes / g.minutes });
  if (g.long && !g.progressive && !cur.canceled && c.progressive) out.push({ key: 'long_progressive' });
  return out;
}
/** Contre-exemples d’une séance générée publiée sans changement. */
export function observeKept(gen: { date: string; title: string; blocks: Block[] }): string[] {
  const g = sessionTraits(gen.title, gen.blocks);
  const out: string[] = [];
  if (g.quality) out.push(`avoid_quality:${g.quality}`);
  if (g.long) for (let d = 1; d <= 7; d++) if (d !== dow(gen.date)) out.push(`long_day:${d}`);
  if (g.long && !g.progressive) out.push('long_progressive');
  if (!g.long && !g.quality) out.push('volume_pct');
  return out;
}
/** Réglages appliqués à un programme (IA ou à la main) → observations. */
export function observeTweaks(t: ProgramTweaks): { key: string; value?: number }[] {
  const out: { key: string; value?: number }[] = t.avoidQuality.map((q) => ({ key: `avoid_quality:${q}` }));
  if (t.maxQualityPerWeek !== null) out.push({ key: `max_quality:${t.maxQualityPerWeek}` });
  if (t.volumePct !== null && t.volumePct < 100) out.push({ key: 'volume_pct', value: t.volumePct / 100 });
  if (t.longDay) out.push({ key: `long_day:${t.longDay}` });
  if (t.longProgressive) out.push({ key: 'long_progressive' });
  return out;
}

/** Omit appliqué à chaque variante de l’union (sinon les champs propres à chaque règle disparaissent). */
type OmitEach<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type MethodRuleDraft = OmitEach<MethodRule, 'id' | 'source' | 'support'>;

export interface MethodCandidate {
  key: string;
  rule: MethodRuleDraft;
  label: string;
  support: number; weeks: number; athletes: number; counter: number; concordance: number;
}

const keyOfRule = (r: Pick<MethodRule, 'kind'> & Partial<{ quality: string; n: number; day: number }>) =>
  r.kind === 'avoid_quality' ? `avoid_quality:${r.quality}` : r.kind === 'max_quality' ? `max_quality:${r.n}` : r.kind === 'long_day' ? `long_day:${r.day}` : r.kind;

/**
 * Candidates (docs/09) : au moins 5 observations indépendantes (une par élève et par semaine), sur 2 semaines au moins,
 * 80 % de concordance avec les contre-exemples ; ni déjà une règle, ni écartée. Portée : le niveau ou le sport commun.
 */
export function learnCandidates(obs: MethodEvidence[], counters: MethodEvidence[], method: CoachMethod): MethodCandidate[] {
  const once = (list: MethodEvidence[]) => [...new Map(list.map((o) => [`${o.key}|${o.athleteId}|${o.week}`, o])).values()];
  const o1 = once(obs), c1 = once(counters);
  const have = new Set(method.rules.map((r) => keyOfRule(r as never)));
  const out: MethodCandidate[] = [];
  for (const key of [...new Set(o1.map((o) => o.key))]) {
    if (have.has(key) || method.dismissed.includes(key)) continue;
    const mine = o1.filter((o) => o.key === key);
    const weeks = new Set(mine.map((o) => o.week)).size;
    const counter = c1.filter((c) => c.key === key && !mine.some((m) => m.athleteId === c.athleteId && m.week === c.week)).length;
    const concordance = mine.length / (mine.length + counter);
    if (mine.length < LEARNING.minSupport || weeks < LEARNING.minWeeks || concordance < LEARNING.minConcordance) continue;
    const levels = new Set(mine.map((o) => o.level)), sports = new Set(mine.map((o) => o.sport));
    const scope = { level: levels.size === 1 ? [...levels][0] ?? null : null, sport: sports.size === 1 ? [...sports][0] ?? null : null };
    const [kind, arg] = key.split(':') as [MethodRuleKind, string | undefined];
    let rule: MethodCandidate['rule'];
    if (kind === 'avoid_quality') rule = { kind, quality: arg as QualityKind, scope };
    else if (kind === 'max_quality') rule = { kind, n: Number(arg), scope };
    else if (kind === 'long_day') rule = { kind, day: Number(arg), scope };
    else if (kind === 'long_progressive') rule = { kind, scope };
    else {
      const vals = mine.map((o) => o.value ?? 1).sort((a, b) => a - b);
      const median = vals[Math.floor(vals.length / 2)]!;
      rule = { kind: 'volume_pct', pct: Math.max(70, Math.min(95, Math.round((median * 100) / 5) * 5)), scope };
    }
    const full = { ...rule, id: '00000000-0000-4000-8000-000000000000', source: 'learned', support: mine.length } as MethodRule;
    out.push({ key, rule, label: ruleLabel(full), support: mine.length, weeks, athletes: new Set(mine.map((o) => o.athleteId)).size, counter, concordance: Math.round(concordance * 100) / 100 });
  }
  return out.sort((a, b) => b.support - a.support);
}
