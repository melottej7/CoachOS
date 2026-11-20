import { z } from 'zod';
import { WEEK_TEMPLATE_MAX_WEEKS, weekDaySchema, type LibraryWorkout } from './library';
import { parseNotation } from './notation';
import type { Sport } from './sports';
import { structureTotals, type Block } from './structure';

/**
 * D-085 : import d’un ancien programme du coach (document texte, copié depuis Google Docs ou Word), semaine par
 * semaine, enregistré comme programme type de la bibliothèque (semaine type de plusieurs semaines, D-083).
 * Complément du fondateur § « import progressif de mes anciens programmes » : aperçu, corrections et validation
 * avant insertion. Les règles de lecture viennent de programmes réels du fondateur ; rien n’est deviné en silence :
 * chaque séance garde sa ligne d’origine et le texte autour d’elle devient ses consignes.
 */

export interface ImportedSession {
  /** Ligne du texte (1 = première). */
  line: number;
  /** Jour (1 = lundi … 7 = dimanche) : écrit dans le texte, sinon réparti. */
  day: number;
  dayGiven: boolean;
  title: string;
  sport: Sport;
  blocks: Block[];
  instructions: string | null;
  optional: boolean;
  minutes: number | null;
}
export interface ImportedWeek { number: number; label: string; line: number; sessions: ImportedSession[] }
export interface ImportedProgram {
  title: string; line: number; weeks: ImportedWeek[]; sessions: number; errors: string[];
  /** D-091 : consignes générales écrites avant la première semaine (objectif, repères, règles), sans les tableaux. */
  notes: string | null;
}
export interface ProgramImportPreview { programs: ImportedProgram[]; errors: string[] }

export const PROGRAM_IMPORT_MAX_CHARS = 200_000;

const WEEKDAYS: [RegExp, number][] = [
  [/^lun(?:di)?\b\.?/i, 1], [/^mar(?:di)?\b\.?/i, 2], [/^mer(?:credi)?\b\.?/i, 3], [/^jeu(?:di)?\b\.?/i, 4],
  [/^ven(?:dredi)?\b\.?/i, 5], [/^sam(?:edi)?\b\.?/i, 6], [/^dim(?:anche)?\b\.?/i, 7],
];
const WEEKDAY_END = /\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*[.!]*\s*$/i;

/** Titre de semaine : « S1 », « ### S3 · Côtes », « Semaine 5 03/08-09/08 », « S1 : » ; pas « S1–S2 · … » (plan). */
const WEEK_HEAD = /^(?:#+\s*)?(?:s|sem\.?|semaine|week|w)\s*(\d{1,2})(?![\d/])(?!\s*[-–—]\s*s?\d{1,2}(?![\d/]))\s*(.*)$/i;
/** Semaine sans numéro : « Semaine 28/09 - 04/10 », « Semaine de course · 30/11–05/12 ». */
const WEEK_HEAD_UNNUMBERED = /^(?:#+\s*)?semaine\s+(?:de\s+course|du\s|\d{1,2}\/\d{1,2})(.*)$/i;

/** Mots qui ouvrent une ligne de séance. */
const SESSION_START = new RegExp(
  '^(?:footing|foot|endurance|ef|sortie|sl|fract[a-zà-ÿ]*|frac|mini|tempo|seuil|vma|test|c[ôo]tes?|pyramide|allure|rappel|r[ée]cup[a-zà-ÿ]*|'
  + 'v[ée]lo|natation|nage|run|course|marche|lignes?|d[ée]blocage|street|trail|renfo[a-zà-ÿ]*|muscu[a-zà-ÿ]*|intro[a-zà-ÿ]*|long|endu|'
  + 'mont[ée]es?|marathon|semi|10\\s?km|12\\s?km|20\\s?km|s[ée]ance|up|veille)(?![a-zà-ÿ])',
  'i',
);
const STRUCTURE_START = /^(?:\d+(?:[.,]\d+)?\s*(?:'|’|"|min|mn|h\b|h\d|km|m\b|k\b|[x×*]|:\d)|\d+\s+mins?\b|r\s*\d)/i;
const REST_LINE = /^(?:repos|off|kin[ée]|rien|libre\b|pas de course)/i;
const RACE_LINE = /^(?:course\b|marathon|semi|race|objectif\s*:?\s*course)/i;

const norm = (s: string) => s.replace(/ /g, ' ').replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();

function sportOfTitle(t: string, fallback: Sport): Sport {
  if (/\b(?:v[ée]lo|home ?trainer|vtt|cyclisme)\b/i.test(t)) return 'cycling';
  if (/\b(?:natation|nage|piscine)\b/i.test(t)) return 'swimming';
  if (/\btrail\b/i.test(t) && fallback === 'running') return 'trail';
  return fallback;
}

/** Jour écrit en tête (« Mar 10 · », « Lundi », « Jeu 31 au matin · ») ou en fin de ligne (« … Mardi »). */
function takeDay(t: string): { day: number | null; rest: string } {
  for (const [re, d] of WEEKDAYS) {
    const m = t.match(re);
    if (m) {
      const rest = t.slice(m[0].length).replace(/^\s*\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?\b/, '')
        .replace(/^\s*(?:(?:et|au|-)\s+[^·:]{0,30}?)?(?:au\s+)?(?:matin|soir|midi)?\s*/i, '').replace(/^\s*[·:–—-]\s*/, '');
      return { day: d, rest: rest.trim() };
    }
  }
  const e = t.match(WEEKDAY_END);
  if (e) return { day: WEEKDAYS.findIndex(([re]) => re.test(e[1]!)) + 1, rest: t.slice(0, e.index).trim() };
  return { day: null, rest: t };
}

/** Une ligne est-elle une séance ? Si oui, son titre, sa structure et la prose qui la suit sur la ligne. */
export function readSessionLine(raw: string, sport: Sport, shiftedZones = false): { day: number | null; title: string; sport: Sport; blocks: Block[]; prose: string | null; optional: boolean } | null {
  // Ligne de tableau (repères, vue d’ensemble) : séance seulement si « Footing | 30' | Z1-2 ».
  const cells = raw.trim().split(/\t+/).map((x) => x.trim()).filter(Boolean);
  if (cells.length >= 3 && !(SESSION_START.test(cells[0]!) && cells.slice(1).some((x) => /^\d+(?:[.,]\d+)?\s*(?:'|’|min|h\b|h\d|km|m\b)/i.test(x)))) return null;
  let t = norm(raw).replace(/^[-•*]\s+/, '').replace(/^#+\s*/, '');
  if (!t || t.startsWith('|')) return null;
  // « Séance 3 (week-end) » : le dimanche.
  let weekend = false;
  t = t.replace(/^s[ée]ance\s*\d*\s*(?:\(([^)]*)\))?\s*[·:.–—-]?\s*/i, (_m, hint?: string) => { weekend = /week-?end/i.test(hint ?? ''); return ''; });
  // Totaux et estimations : « (≈ 45') », « (~7 km) », « (33') », « (1h04) ».
  t = t.replace(/\(\s*[~≈][^()]*\)/g, ' ').replace(/\(\s*\d+\s*(?:'|’|min|h\d*)\s*(?:[-–]\s*\d+\s*(?:'|’))?\s*\)/gi, ' ').replace(/\s+/g, ' ').trim();
  const d = takeDay(t);
  if (d.day === null && weekend) d.day = 7;
  t = d.rest;
  if (!t || REST_LINE.test(t)) return null;
  let optional = false;
  t = t.replace(/\(?\s*\b(optionnel(?:le)?|facultati(?:f|ve)|bonus)\b\s*\)?\s*:?/gi, () => { optional = true; return ' '; }).replace(/\s+/g, ' ').trim();
  t = t.replace(/^s[ée]ance\s*[·:]?\s*/i, '');
  if (!t) return null;
  if (!(SESSION_START.test(t) || STRUCTURE_START.test(t))) return null;

  // Titre et structure : « Fractionné 200 m (≈ 45') : 15' Z1 + … » ; « Footing 30' Z1-2 : test d’aisance. »
  let title = '', structure = t, prose: string | null = null;
  const c = t.match(/^(.{1,80}?)\s*:\s+(.+)$/);
  if (c) {
    const left = c[1]!, right = c[2]!;
    const rightIsStructure = STRUCTURE_START.test(right) || /^(?:z\d|ef\b)/i.test(right) || /^[^\d.]{0,20}\d+\s*[x×*]\s*[(\d]/i.test(right);
    // Structure plus loin dans la phrase : « même échauffement qu’en S1 : 10' Z1 + 5 km chrono + 5' Z1 ».
    const inner = rightIsStructure ? null : right.match(/(?:^|[:.]\s+)((?:\d+\s*[x×*]\s*)?\d+(?:[.,]\d+)?\s*(?:'|’|"|min|h\d*|km|m)[^.]*?\+[^.]*)/i);
    if (rightIsStructure && /\d+\s*(?:'|’|h\d*|min)/.test(left) && /\+/.test(left)) { title = left; structure = `${left} + ${right}`; }
    else if (rightIsStructure) { title = left; structure = right; }
    else if (inner) { title = left; structure = inner[1]!; prose = right.replace(inner[1]!, ' ').replace(/\s+/g, ' ').trim() || null; }
    else { structure = left; prose = right; }
  }
  // La prose après la structure : la première coupure (« . » ou « , » + mot) après laquelle il n’y a plus d’étape.
  const cuts = [...structure.matchAll(/(?:\.\s+|,\s+(?=[a-zà-ÿ]))/gi)];
  for (const m of cuts) {
    const before = structure.slice(0, m.index), after = structure.slice(m.index! + m[0].length);
    if (!/\d/.test(before)) continue;
    if (/^\s*(?:\+|\d|puis\b)/i.test(after) || /\d+\s*[x×*]\s*[(\d]/.test(after) || /\s\+\s*\d/.test(after)) continue;
    structure = before; prose = [after, prose].filter(Boolean).join(' ') || prose;
    break;
  }
  const sp = sportOfTitle(`${title} ${structure}`, sport);
  const label = structure.match(/^([^\d(]{2,40}?)\s+(?=\d)/)?.[1]?.trim() ?? '';
  const isRace = RACE_LINE.test(t) && !/[+×*]/.test(structure);
  const n = parseNotation(isRace ? structure.replace(/^[^\d]*/, '') : structure, sp, { lenient: true, shiftedZones });
  let blocks = n.errors.length ? [] : n.blocks;
  // Séance d’un seul bloc sans intensité : facile (footing, endurance), récupération si dite.
  if (blocks.length === 1 && blocks[0]!.type === 'step' && blocks[0]!.intensity.kind === 'none' && !isRace) {
    const zone = /r[ée]cup/i.test(`${title} ${label}`) ? 1 : /\b(?:footing|endurance|ef|sortie|sl|long|foot)\b/i.test(`${title} ${label}`) ? 2 : null;
    if (zone) blocks = [{ ...blocks[0]!, intensity: { kind: 'zone', zone } }];
  }
  if (!blocks.length && !isRace && !(SESSION_START.test(t) && t.split(' ').length <= 2)) return null;
  const cleanTitle = (title || (label && !/^\d/.test(label) ? `${label} ${structure.slice(label.length).trim()}` : structure))
    .replace(/\(\s*[~≈][^)]*\)/g, '').replace(/\s+/g, ' ').trim().replace(/[\s.,;:]+$/, '');
  return {
    day: d.day, title: (cleanTitle.length > 80 ? `${cleanTitle.slice(0, 77).trim()}…` : cleanTitle) || 'Séance',
    sport: sp, blocks, prose, optional,
  };
}

/** Jours par défaut d’une semaine de n séances sans jour écrit : l’ordre du document, la dernière le dimanche. */
const DEFAULT_DAYS: Record<number, number[]> = {
  1: [7], 2: [3, 7], 3: [2, 4, 7], 4: [2, 3, 5, 7], 5: [1, 2, 4, 5, 7], 6: [1, 2, 3, 5, 6, 7], 7: [1, 2, 3, 4, 5, 6, 7],
};
function placeDays(sessions: { day: number | null }[]): number[] {
  if (sessions.every((s) => s.day === null)) {
    const pool = DEFAULT_DAYS[Math.min(7, sessions.length)] ?? DEFAULT_DAYS[7]!;
    return sessions.map((_, k) => pool[Math.min(k, pool.length - 1)]!);
  }
  // Jours écrits : les séances sans jour se placent entre leurs voisines, dans l’ordre du document, espacées.
  const out = sessions.map((s) => s.day);
  for (let i = 0; i < out.length;) {
    if (out[i] !== null) { i++; continue; }
    let j = i;
    while (j < out.length && out[j] === null) j++;
    const lo = i > 0 ? out[i - 1]! : 0, hi = j < out.length ? out[j]! : 8;
    const a = Math.min(7, lo + 1), b = Math.max(a, Math.max(1, hi - 1));
    const k = j - i;
    // Avant le premier jour écrit : la forme habituelle de la semaine (« Mar, Jeu » avant un dimanche).
    const shape = lo === 0 && hi <= 7 ? (DEFAULT_DAYS[Math.min(7, k + 1)] ?? []).slice(0, k).filter((d) => d < hi) : [];
    if (shape.length === k) { shape.forEach((d, x) => { out[i + x] = d; }); i = j; continue; }
    for (let x = 0; x < k; x++) out[i + x] = hi <= lo + 1 ? Math.max(1, Math.min(7, lo || hi)) : k === 1 ? (hi === 8 ? b : a) : Math.round(a + (x * (b - a)) / (k - 1));
    i = j;
  }
  return out.map((d) => d ?? 7);
}

/** Titre de programme probable : court, et qui parle d’un programme ou d’une course. */
function isProgramTitle(t: string): boolean {
  if (t.split(' ').length > 12 || /^(?:s\d|semaine|sem\b)/i.test(t)) return false;
  return /\b(?:programme|plan|pr[ée]pa(?:ration)?|semi|marathon|objectif|trail|course|road to|\d+\s?km|bloc\s+\d+\s+semaines?|\d+\s+semaines)\b/i.test(t);
}

interface RawWeek { number: number | null; explicit: boolean; label: string; line: number; lines: { n: number; text: string }[] }
/** « 1 semaine de diminution » : une semaine sans numéro, si aucune semaine numérotée ne suit aussitôt. */
const WEEK_PHASE_LINE = /^\d\s+semaines?\s+(?:de|d’|d')\s*\S/i;

/** Aperçu de l’import d’un programme : un ou plusieurs programmes trouvés, semaine par semaine. */
export function previewProgramImport(text: string, opts: { defaultSport: Sport; shiftedZones?: boolean }): ProgramImportPreview {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!src.trim()) return { programs: [], errors: ['Rien à importer : colle ton programme.'] };
  if (src.length > PROGRAM_IMPORT_MAX_CHARS) return { programs: [], errors: [`Texte trop long (${PROGRAM_IMPORT_MAX_CHARS / 1000} 000 caractères au plus) : importe un programme à la fois.`] };
  const lines = src.split('\n');

  // 1. Semaines, regroupées en programmes : une numérotation qui repart (S1 après S6) ouvre un nouveau programme.
  const groups: { titleLine: number; weeks: RawWeek[] }[] = [];
  let cur: RawWeek | null = null;
  let lastTitleCandidate = { n: 0, text: '' };
  lines.forEach((raw, i) => {
    const text = raw.replace(/ /g, ' ').trim();
    if (!text) return;
    const isTable = /\t/.test(raw.trim()) && !/^\s*(?:footing|endurance|fract|mini|ef)\b/i.test(text) || text.startsWith('|');
    const h = isTable ? null : norm(text).match(WEEK_HEAD);
    const nextText = norm(lines.slice(i + 1).find((l) => l.trim()) ?? '');
    const phaseWeek = !isTable && !h && cur && WEEK_PHASE_LINE.test(norm(text)) && !WEEK_HEAD.test(nextText);
    const hu = isTable || h ? null : norm(text).match(WEEK_HEAD_UNNUMBERED) ?? (phaseWeek ? [text] : null);
    if ((h || hu) && !/^semaine\s+type\b/i.test(norm(text))) {
      const prevGroup = groups[groups.length - 1];
      const prev: RawWeek | null = cur;
      const prevNumber = prev?.number ?? null;
      const number = h ? Number(h[1]) : prevNumber !== null ? prevNumber + 1 : 1;
      // Nouveau programme : numérotation qui repart, ou semaines datées (« Semaine 28/09 ») après des semaines numérotées.
      const datedAfterNumbered = !h && /^(?:#+\s*)?semaine\s+\d{1,2}\//i.test(norm(text)) && Boolean(prev?.explicit);
      const restart = !prevGroup || (prevNumber !== null && number <= prevNumber && Boolean(h)) || datedAfterNumbered;
      // Titre : la dernière ligne-titre vue depuis la semaine précédente (sinon, aucun).
      if (restart) groups.push({ titleLine: lastTitleCandidate.n > (prev?.line ?? 0) ? lastTitleCandidate.n : 0, weeks: [] });
      cur = { number: datedAfterNumbered ? 1 : number, explicit: Boolean(h), label: norm(text).replace(/^#+\s*/, '').slice(0, 80), line: i + 1, lines: [] };
      groups[groups.length - 1]!.weeks.push(cur);
      return;
    }
    // Candidat titre de programme : ligne courte sans structure ni séance.
    if (norm(text).length <= 90 && !/\t/.test(raw.trim()) && !STRUCTURE_START.test(norm(text)) && !/\+/.test(text) && !/^(?:bloc\s*\d|structure|rep[èe]res|r[èe]gles|vue d|programme semaine)/i.test(norm(text)) && !/[.:]\s*$/.test(text) && isProgramTitle(norm(text))) {
      lastTitleCandidate = { n: i + 1, text: norm(text).replace(/^#+\s*/, '') };
    }
    if (cur) (cur as RawWeek).lines.push({ n: i + 1, text: raw });
  });

  // 2. Séances de chaque semaine ; la prose qui suit une séance devient ses consignes.
  const programs: ImportedProgram[] = [];
  const firstLine = lines.findIndex((l) => l.trim());
  const docTitle = firstLine >= 0 && norm(lines[firstLine]!).length <= 90 && !readSessionLine(lines[firstLine]!, opts.defaultSport) && !WEEK_HEAD.test(norm(lines[firstLine]!))
    ? { n: firstLine + 1, text: norm(lines[firstLine]!).replace(/^#+\s*/, '') } : null;
  for (const g of groups) {
    const next = groups[groups.indexOf(g) + 1];
    const lastHead = g.weeks[g.weeks.length - 1]!.line;
    const nextTitle = next ? (next.titleLine > lastHead ? next.titleLine : next.weeks[0]!.line) : Infinity;
    const first = g.weeks[0]!.number ?? 1;
    const weeks: ImportedWeek[] = [];
    for (const w of g.weeks) {
      const found: (Omit<ImportedSession, 'day' | 'dayGiven' | 'minutes' | 'instructions'> & { day: number | null; notes: string[] })[] = [];
      const intro: string[] = [];
      for (const l of w.lines) {
        if (l.n >= nextTitle) break;
        const s = readSessionLine(l.text, opts.defaultSport, Boolean(opts.shiftedZones));
        if (s) {
          found.push({ line: l.n, day: s.day, title: s.title, sport: s.sport, blocks: s.blocks, optional: s.optional, notes: s.prose ? [s.prose] : [] });
        } else {
          const p = norm(l.text);
          if (!p || p.startsWith('|') || REST_LINE.test(takeDay(p).rest) || /^(?:repos|off)\b/i.test(p)) continue;
          (found[found.length - 1]?.notes ?? intro).push(p.replace(/^#+\s*/, ''));
        }
      }
      const days = placeDays(found);
      weeks.push({
        number: w.number ?? first,
        label: w.label,
        line: w.line,
        sessions: found.map((s, k) => {
          const secs = s.blocks.length ? structureTotals(s.blocks, { sport: s.sport }).seconds : 0;
          const instructions = s.notes.join('\n').trim().slice(0, 5000) || null;
          return {
            line: s.line, day: days[k]!, dayGiven: s.day !== null, title: s.optional ? `${s.title} (optionnelle)`.slice(0, 120) : s.title.slice(0, 120),
            sport: s.sport, blocks: s.blocks, instructions, optional: s.optional, minutes: secs ? Math.round(secs / 60) : null,
          };
        }),
      });
    }
    while (weeks.length && !weeks[weeks.length - 1]!.sessions.length) weeks.pop();
    const sessions = weeks.reduce((n, w) => n + w.sessions.length, 0);
    // Plan ou sommaire en tête de document (« S8 · Affûtage + test : … ») : pas un programme ; son titre passe au suivant.
    const maxNumber = Math.max(...g.weeks.map((w) => w.number ?? 0));
    const outline = next && (next.weeks[0]!.number ?? 1) <= maxNumber && sessions < g.weeks.length;
    if (!sessions || outline) { if (next && !next.titleLine) next.titleLine = g.titleLine; continue; }
    const errors: string[] = [];
    const span = Math.max(...weeks.map((w) => w.number)) - first + 1;
    if (span > WEEK_TEMPLATE_MAX_WEEKS) errors.push(`${span} semaines : un programme type en compte ${WEEK_TEMPLATE_MAX_WEEKS} au plus. Coupe-le en deux imports.`);
    const own = g.titleLine ? norm(lines[g.titleLine - 1] ?? '').replace(/^#+\s*/, '') : '';
    const titleText = !programs.length && docTitle && docTitle.n < g.weeks[0]!.line ? docTitle.text : own;
    // D-091 : texte d’introduction (après le titre, avant la première semaine) : objectif, repères, règles importantes.
    const introFrom = g.titleLine || (groups.indexOf(g) === 0 ? 0 : g.weeks[0]!.line - 1);
    const intro = lines.slice(introFrom, g.weeks[0]!.line - 1)
      .filter((l) => l.trim() && !/\t/.test(l.trim()) && !l.trim().startsWith('|') && !WEEK_HEAD.test(norm(l)) && !/^s\d+\s*[-–—]\s*s?\d/i.test(norm(l)))
      .map((l) => norm(l).replace(/^#+\s*/, ''))
      .filter((l) => l !== titleText);
    const notes = intro.join('\n').slice(0, 4000).trim() || null;
    programs.push({ title: (titleText || `Programme importé · ${weeks.length} semaines`).slice(0, 120), line: g.titleLine || weeks[0]!.line, weeks, sessions, errors, notes });
  }
  const errors = programs.length ? [] : ['Aucune semaine trouvée : chaque semaine doit commencer par une ligne « S1 », « Semaine 1 »…'];
  return { programs, errors };
}

/** Séances du programme → jours d’une semaine type (décalage depuis le premier lundi). */
export function programTemplateDays(p: ImportedProgram, skip: ReadonlySet<number> = new Set()): { offset: number; workout: LibraryWorkout }[] {
  const first = Math.min(...p.weeks.map((w) => w.number));
  return p.weeks.flatMap((w) => w.sessions.filter((s) => !skip.has(s.line)).map((s) => ({
    offset: (w.number - first) * 7 + (s.day - 1),
    workout: {
      sport: s.sport, title: s.title, instructions: s.instructions,
      durationSeconds: null, distanceM: null, intervals: s.blocks,
    } as LibraryWorkout,
  })));
}

/** POST …/templates/import-program : programme type créé depuis l’aperçu (rien n’est appliqué à un élève). */
export const importProgramSchema = z.object({
  title: z.string().trim().min(1, { message: 'Donne un nom au programme' }).max(120, { message: '120 caractères au plus' }),
  weeks: z.number().int().min(1).max(WEEK_TEMPLATE_MAX_WEEKS, { message: `${WEEK_TEMPLATE_MAX_WEEKS} semaines au plus` }),
  days: z.array(weekDaySchema).min(1, { message: 'Choisis au moins une séance' }).max(200),
  /** D-091 : consignes générales du programme, ajoutées à la première séance quand il est appliqué. */
  notes: z.string().trim().max(4000, { message: '4000 caractères au plus' }).nullish().transform((v) => (v ? v : null)),
}).strict().superRefine((v, ctx) => {
  if (v.days.some((d) => d.offset >= v.weeks * 7)) ctx.addIssue({ code: 'custom', path: ['days'], message: 'Une séance dépasse la dernière semaine' });
});
export type ImportProgramInput = z.output<typeof importProgramSchema>;
