import { stepLevel } from './session-profile';
import type { Sport } from './sports';
import type { Block, Intensity, Measure, Phase, Step } from './structure';

// CE-B-09 (D-041) : saisie rapide d’une séance en notation texte, comme sur papier, et l’inverse.
//   « 15' Z1 + 8×(400m Z5 + R200m) + 10' Z1 »
// Durées : 15'  1'30  45"  1h  1h30 · Distances : 400m  10km  1,5km · Bloc libre : libre
// Intensités : Z1…Z7 · @4'30/km  @4'30-4'15/km  @1'45/100m · RPE7 · 95%FTP  250W · 150bpm  85%FC
// Phases : R200m = récupération ; « échauffement », « calme », « repos » en tête d’étape (sinon déduites) ;
// sport en multisport : « vélo 1h Z2 + course 20' Z3 » ; note entre guillemets « ».

export interface NotationError { item: string; message: string }
export interface NotationResult { blocks: Block[]; errors: NotationError[] }

const SPORT_WORDS: [RegExp, Sport][] = [
  [/^(?:vélo|velo)(?![a-zà-ÿ])/i, 'cycling'],
  [/^(?:course|cap)(?![a-zà-ÿ])/i, 'running'],
  [/^trail(?![a-zà-ÿ])/i, 'trail'],
  [/^(?:natation|nat)(?![a-zà-ÿ])/i, 'swimming'],
];
const SPORT_WORD: Partial<Record<Sport, string>> = { cycling: 'vélo', running: 'course', trail: 'trail', swimming: 'natation' };
const PHASE_WORDS: [RegExp, Phase][] = [
  [/^(?:échauffement|echauffement|échauf|echauf)(?![a-zà-ÿ])/i, 'warmup'],
  [/^(?:retour au calme|calme|rac)(?![a-zà-ÿ])/i, 'cooldown'],
  [/^(?:récupération|recuperation|récup|recup)(?![a-zà-ÿ])/i, 'recovery'],
  [/^repos(?![a-zà-ÿ])/i, 'rest'],
  [/^(?:effort)(?![a-zà-ÿ])/i, 'work'],
];
const PHASE_WORD: Record<Phase, string> = { warmup: 'échauffement', cooldown: 'calme', recovery: 'récup', rest: 'repos', work: 'effort', other: 'effort' };

const mmss = (m: string, s: string) => Number(m) * 60 + Number(s);

/** Découpe au premier niveau sur « + », en respectant les parenthèses. */
function splitTop(text: string): string[] | null {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return null;
    if (ch === '+' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (depth !== 0) return null;
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseMeasure(t: string): { measure: Measure; rest: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^libre\b/i))) return { measure: { kind: 'open' }, rest: t.slice(m[0].length) };
  if ((m = t.match(/^(\d+)\s*h\s*(\d{1,2})?(?:\s*(?:min|mn|'|’))?/i))) {
    return { measure: { kind: 'time', seconds: Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60 }, rest: t.slice(m[0].length) };
  }
  if ((m = t.match(/^(\d+(?:[.,]\d+)?)\s*(km|m)(?![a-zà-ÿ])/i))) {
    const v = Number(m[1]!.replace(',', '.'));
    return { measure: { kind: 'distance', meters: Math.round(m[2]!.toLowerCase() === 'km' ? v * 1000 : v) }, rest: t.slice(m[0].length) };
  }
  if ((m = t.match(/^(\d+)\s*(?:'|’|min|mn)(?:(\d{1,2})(?![\d.,]*\s*k?m\b)|\s+(\d{1,2})(?=\s*["”]))?\s*(?:"|”|s\b)?/i))) {
    return { measure: { kind: 'time', seconds: mmss(m[1]!, m[2] ?? m[3] ?? '0') }, rest: t.slice(m[0].length) };
  }
  if ((m = t.match(/^(\d+)\s*(?:"|”|s\b|sec\b)/i))) return { measure: { kind: 'time', seconds: Number(m[1]) }, rest: t.slice(m[0].length) };
  return null;
}

function parseIntensity(t: string): { intensity: Intensity; rest: string } {
  const take = (m: RegExpMatchArray, intensity: Intensity) => ({ intensity, rest: t.replace(m[0], ' ') });
  let m: RegExpMatchArray | null;
  if ((m = t.match(/\bz\s*([1-7])\b/i))) return take(m, { kind: 'zone', zone: Number(m[1]) });
  if ((m = t.match(/@\s*(\d{1,2})['’:](\d{2})(?:\s*[-–à]\s*(\d{1,2})['’:](\d{2}))?\s*(?:\/\s*(km|100\s*m))?/i))) {
    const a = mmss(m[1]!, m[2]!), b = m[3] ? mmss(m[3], m[4]!) : null;
    return take(m, { kind: 'pace', unit: m[5] && m[5].replace(/\s/g, '').toLowerCase() === '100m' ? 'per_100m' : 'per_km', min: b === null ? a : Math.min(a, b), max: b === null ? null : Math.max(a, b) });
  }
  if ((m = t.match(/\brpe\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?/i))) return take(m, { kind: 'rpe', min: Number(m[1]), max: m[2] ? Number(m[2]) : null });
  if ((m = t.match(/(\d{2,3})(?:\s*[-–]\s*(\d{2,3}))?\s*%\s*ftp\b/i))) return take(m, { kind: 'power', unit: 'pct_ftp', min: Number(m[1]), max: m[2] ? Number(m[2]) : null });
  if ((m = t.match(/(\d{2,4})(?:\s*[-–]\s*(\d{2,4}))?\s*w\b/i))) return take(m, { kind: 'power', unit: 'w', min: Number(m[1]), max: m[2] ? Number(m[2]) : null });
  if ((m = t.match(/(\d{2,3})(?:\s*[-–]\s*(\d{2,3}))?\s*bpm\b/i))) return take(m, { kind: 'hr', unit: 'bpm', min: Number(m[1]), max: m[2] ? Number(m[2]) : null });
  if ((m = t.match(/(\d{2,3})(?:\s*[-–]\s*(\d{2,3}))?\s*%\s*(?:fc\s*max|fcm|fc)\b/i))) return take(m, { kind: 'hr', unit: 'pct_max', min: Number(m[1]), max: m[2] ? Number(m[2]) : null });
  return { intensity: { kind: 'none' }, rest: t };
}

/** Lecture tolérante : « 1:30 » vaut aussi une durée en tête d’étape. */
function parseMeasureLenient(t: string): { measure: Measure; rest: string } | null {
  const m = t.match(/^(\d{1,2}):(\d{2})(?![\d:])/);
  if (m) return { measure: { kind: 'time', seconds: mmss(m[1]!, m[2]!) }, rest: t.slice(m[0].length) };
  const r = parseMeasure(t);
  if (r) return r;
  // « 15 Z1 » : un nombre sans unité suivi d’une zone ou d’une allure vaut des minutes.
  const b = t.match(/^(\d{1,3})(?=\s+(?:z\s*\d|@)|\s*$)/i);
  return b ? { measure: { kind: 'time', seconds: Number(b[1]) * 60 }, rest: t.slice(b[0].length) } : null;
}

/** Lecture tolérante : la première durée ou distance de l’étape, avec les mots qui la précèdent. */
function findMeasure(t: string): { prefix: string; measure: Measure; rest: string } | null {
  const direct = parseMeasureLenient(t);
  if (direct) return { prefix: '', ...direct };
  const re = /(^|[\s(/])(?=\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const at = m.index + m[1]!.length;
    const r = parseMeasureLenient(t.slice(at));
    if (r) return { prefix: t.slice(0, at), ...r };
    re.lastIndex = at + 1;
  }
  return null;
}

/** Mots sans valeur dans une étape (« de footing », « ok ») ; ceux qui disent l’intensité facile. */
const EASY_WORDS = /\b(?:footing|endurance|sortie longue|sl)\b/i;
const FILLER = /(?<!allure\s)\b(?:de\s+|d')?(?:course|run|footing|endurance|sortie longue|ok)\b|^\s*(?:de|d'|du|à|en|:)\s+/gi;

type ParsedStep = Step & { implicit: boolean; walk?: boolean; recup?: boolean };
/** Lecture tolérante : texte sans durée ni distance (« lignes droites », « renfo »), rattaché à l’étape voisine. */
type LooseText = { type: 'text'; text: string };

/** Une étape ; `phase` est null quand elle doit être déduite de sa place. */
function parseStep(raw: string, errors: NotationError[], lenient = false, inRepeat = false): ParsedStep | LooseText | null {
  let t = raw.trim();
  let note: string | null = null;
  const q = t.match(/[«"]\s*([^»"]*?)\s*[»"]\s*$/);
  if (q && !(lenient && /\d\s*"\s*$/.test(t))) { note = q[1]!.slice(0, 200) || null; t = t.slice(0, q.index).trim(); }
  let sport: Sport | null = null;
  for (const [re, s] of SPORT_WORDS) { const m = t.match(re); if (m) { sport = s; t = t.slice(m[0].length).replace(/^\s*:?\s*/, ''); break; } }
  let phase: Phase | null = null;
  for (const [re, p] of PHASE_WORDS) { const m = t.match(re); if (m) { phase = p; t = t.slice(m[0].length).replace(/^\s*:?\s*/, ''); break; } }
  if (!phase && /^r\s*(?=\d)/i.test(t)) { phase = 'recovery'; t = t.replace(/^r\s*/i, ''); }
  if (lenient && !phase && /^r\b\s*/i.test(t)) { phase = 'recovery'; t = t.replace(/^r\b\s*/i, ''); }
  const found = lenient ? findMeasure(t) : (() => { const r = parseMeasure(t); return r ? { prefix: '', ...r } : null; })();
  if (!found) {
    // Lecture tolérante : « R descente en trottinant » = récupération libre, la consigne en note.
    if (lenient && phase === 'recovery') {
      return { type: 'step', phase, implicit: false, sport, measure: { kind: 'open' }, intensity: { kind: 'none' }, cadence: null, note: [t, note].filter(Boolean).join(' · ').slice(0, 200) || null };
    }
    // Dans une répétition : effort libre avec sa consigne (« montée up ») ; ailleurs : note de l’étape voisine.
    if (lenient && t) {
      if (inRepeat) return { type: 'step', phase: phase ?? 'work', implicit: phase === null, sport, measure: { kind: 'open' }, intensity: { kind: 'none' }, cadence: null, note: [t, note].filter(Boolean).join(' · ').slice(0, 200) };
      return { type: 'text', text: [t, note].filter(Boolean).join(' · ') };
    }
    errors.push({ item: raw, message: `« ${raw || '…'} » : durée ou distance attendue au début (ex. 15', 1h30, 400m, 10km)` });
    return null;
  }
  const meas = found;
  let body = `${meas.prefix} ${meas.rest}`;
  // D-084 : un plafond cardiaque (« < 160 bpm ») reste une consigne écrite, pas une intensité enregistrée.
  const cap = lenient ? body.match(/(?:<|sous|max\.?|moins de)\s*(\d{2,3})\s*bpm/i) : null;
  if (cap) { body = body.replace(cap[0], ' '); note = [`sous ${cap[1]} bpm`, note].filter(Boolean).join(' · '); }
  let { intensity, rest } = parseIntensity(body);
  let walk = false, recup = false;
  if (lenient) {
    // Les mots restants deviennent la note de l’étape : rien n’est perdu, rien n’est refusé.
    walk = /\bmarche\b/i.test(rest);
    recup = /\br[ée]cup/i.test(rest);
    if (intensity.kind === 'none' && EASY_WORDS.test(rest)) intensity = { kind: 'zone', zone: 2 };
    if (intensity.kind === 'none' && /\br[ée]cup/i.test(rest)) intensity = { kind: 'zone', zone: 1 };
    let words = rest.replace(FILLER, ' ').replace(/[\s,;·]+/g, ' ').replace(/^[\s:–-]+|[\s:–-]+$/g, '').trim();
    if (/^(?:(?:en|de|à|du|d'|et|avec|ou|la|le|les|au)\s*)+$/i.test(words)) words = '';
    if (words) note = [words, note].filter(Boolean).join(' · ').slice(0, 200);
    rest = '';
  }
  const left = rest.replace(/[\s,;·]+/g, ' ').trim();
  if (left) errors.push({ item: raw, message: `« ${left} » non compris dans « ${raw} » (une note s’écrit entre « »)` });
  if (meas.measure.kind === 'time' && (meas.measure.seconds < 1 || meas.measure.seconds > 86400)) errors.push({ item: raw, message: `« ${raw} » : durée hors limites` });
  if (meas.measure.kind === 'distance' && (meas.measure.meters < 1 || meas.measure.meters > 1_000_000)) errors.push({ item: raw, message: `« ${raw} » : distance hors limites` });
  return { type: 'step', phase: phase ?? 'work', implicit: phase === null, ...(walk ? { walk } : {}), ...(recup ? { recup } : {}), sport, measure: meas.measure, intensity, cadence: null, note };
}

type Parsed = ParsedStep | { type: 'repeat'; times: number; steps: Parsed[] };

function parseSeq(text: string, depth: number, errors: NotationError[], lenient = false): Parsed[] {
  const parts = splitTop(text);
  if (!parts) { errors.push({ item: text, message: 'Parenthèses mal fermées' }); return []; }
  const out: Parsed[] = [];
  const loose: { at: number; text: string }[] = [];
  for (let part of parts) {
    if (!part) {
      if (lenient) continue;
      errors.push({ item: text, message: 'Étape vide : un « + » en trop ?' }); continue;
    }
    // Lecture tolérante : « à la fin, 4×(20" + R40") » → la répétition, sans les mots devant.
    if (lenient) { const pre = part.match(/^[^\d()]*?(?=\d+\s*[x×*]\s*[\d(])/i); if (pre && pre[0]) part = part.slice(pre[0].length); }
    const r = part.match(/^(\d+)\s*[x×*]\s*([\s\S]+)$/i);
    if (r) {
      const times = Number(r[1]);
      if (times < 2 || times > 50) errors.push({ item: part, message: `« ${part} » : de 2 à 50 répétitions` });
      if (depth >= 2) { errors.push({ item: part, message: 'Une répétition peut en contenir une autre, pas davantage' }); continue; }
      let inner = r[2]!.trim();
      // Lecture tolérante : « 8×(20" + R40") à la fin » → la répétition, les mots qui suivent en note.
      if (lenient && inner.startsWith('(')) {
        let dep = 0, close = -1;
        for (let k = 0; k < inner.length; k++) { if (inner[k] === '(') dep++; if (inner[k] === ')' && --dep === 0) { close = k; break; } }
        const tail = close > 0 ? inner.slice(close + 1).replace(/^[\s.,;]+/, '').trim() : '';
        if (close > 0 && tail) { loose.push({ at: out.length + 1, text: tail }); inner = inner.slice(0, close + 1); }
      }
      if (inner.startsWith('(') && inner.endsWith(')') && splitTop(inner.slice(1, -1)) !== null) inner = inner.slice(1, -1);
      const steps = parseSeq(inner, depth + 1, errors, lenient);
      if (steps.length) out.push({ type: 'repeat', times: Math.max(2, Math.min(50, times)), steps });
      continue;
    }
    if (part.startsWith('(') && part.endsWith(')')) { out.push(...parseSeq(part.slice(1, -1), depth, errors, lenient)); continue; }
    const s = parseStep(part, errors, lenient, depth > 0);
    if (s?.type === 'text') { loose.push({ at: out.length, text: s.text }); continue; }
    if (s) out.push(s);
  }
  // Textes sans durée : en note de l’étape précédente (ou suivante en tête).
  for (const l of loose) {
    const target = out[l.at - 1] ?? out[l.at];
    if (target && target.type === 'step') target.note = [target.note, l.text].filter(Boolean).join(' + ').slice(0, 200);
    else if (target && target.type === 'repeat') {
      const st = target.steps[target.steps.length - 1];
      if (st && st.type === 'step') st.note = [st.note, l.text].filter(Boolean).join(' + ').slice(0, 200);
    } else errors.push({ item: l.text, message: `« ${l.text} » : durée ou distance attendue (ex. 15', 1h30, 400m, 10km)` });
  }
  return out;
}

const levelOf = (b: Parsed, sport: Sport): number =>
  b.type === 'repeat' ? Math.max(0, ...b.steps.map((x) => levelOf(x, sport))) : b.intensity.kind === 'none' ? 0 : stepLevel(b, sport).level;

/** Phases déduites : en tête, l’étape moins intense que la suite = échauffement ; en fin, = retour au calme. */
function settle(items: Parsed[], sport: Sport, inRepeat: boolean): Block[] {
  return items.map((b, i) => {
    if (b.type === 'repeat') return { type: 'repeat', times: b.times, steps: settle(b.steps, sport, true) };
    const { implicit, walk, recup, ...step } = b;
    if (implicit && recup && inRepeat) return { ...step, phase: 'recovery' };
    // Lecture tolérante : la marche est un échauffement en tête, un retour au calme en fin, sinon une récupération.
    if (implicit && walk && (inRepeat || items.length > 1)) return { ...step, phase: inRepeat ? 'recovery' : i === 0 ? 'warmup' : i === items.length - 1 ? 'cooldown' : 'recovery' };
    if (!implicit || inRepeat || items.length < 2) return step;
    const me = levelOf(b, sport);
    if (i === 0 && Math.max(...items.slice(1).map((x) => levelOf(x, sport))) > me) return { ...step, phase: 'warmup' };
    if (i === items.length - 1 && Math.max(...items.slice(0, -1).map((x) => levelOf(x, sport))) > me) return { ...step, phase: 'cooldown' };
    return step;
  });
}

export interface NotationOptions {
  /**
   * Lecture tolérante (D-085) : l’écriture libre d’un coach (« Footing 45' Z1-2 », « 3*(2km 4'40 + 400m Z1) »,
   * « 6x800m à 4:30/km (récup 1'30) »). Les mots non compris deviennent des notes au lieu d’erreurs.
   * Réservée à l’import ; l’éditeur reste strict.
   */
  lenient?: boolean;
  /** D-087 : zones écrites dans l’échelle des documents du fondateur (un cran plus bas que CoachOS). */
  shiftedZones?: boolean;
}

/** D-087 : « Z1-2 » ou « Z1-Z2 » dans un texte = l’échelle des documents du fondateur. */
export function detectShiftedZones(text: string): boolean {
  return /\bZ\s*1\s*-\s*Z?\s*2\b/i.test(text);
}

/** Texte → blocs, avec les erreurs à corriger (aucune perte silencieuse). */
export function parseNotation(text: string, sport: Sport, opts: NotationOptions = {}): NotationResult {
  const errors: NotationError[] = [];
  const lenient = Boolean(opts.lenient);
  const clean = (lenient ? normalizeCoachWriting(text, { shiftedZones: opts.shiftedZones }) : text).replace(/\s+/g, ' ').trim();
  if (!clean) return { blocks: [], errors };
  const parsed = parseSeq(clean, 0, errors, lenient);
  return { blocks: settle(parsed, sport, false), errors };
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** « 4'40 » ou « 4'15-4'25 » (la seconde minute peut manquer : « 4:15-25 »). */
function paceText(a: string, b: string, c?: string, d?: string): string {
  return `@${Number(a)}'${b}${d ? `-${Number(c ?? a)}'${d}` : ''}/km`;
}

/**
 * D-085 : écriture libre d’un coach → notation de l’éditeur. Chaque règle vient de programmes réels du fondateur.
 * Ce qui reste incompris est gardé en note par la lecture tolérante.
 */
export function normalizeCoachWriting(text: string, opts: { shiftedZones?: boolean } = {}): string {
  let s = ` ${text} `
    .replace(/[’‘´`]/g, "'").replace(/[”“]/g, '"').replace(/''/g, '"').replace(/\t/g, ' ').replace(/\u00a0/g, ' ');
  // Pyramide : « 1' – 2' – 3' – 2' – 1' Z4 avec R1' entre chaque ».
  s = s.replace(/((?:\d+'\d*\s*[-–—]\s*){2,}\d+'\d*)\s*(Z\s*\d(?:\s*-\s*Z?\d)?)?\s*(?:avec\s+)?(R\s*[\d'"]+(?:k?m)?)\s*entre\s+chaque/gi,
    (_m, list: string, z: string | undefined, r: string) => list.split(/\s*[-–—]\s*/).map((d, i, a) => `${d}${z ? ` ${z}` : ''}${i < a.length - 1 ? ` + ${r}` : ''}`).join(' + '));
  s = s.replace(/[–—]/g, '-');
  // « 2ou3*( » : la première valeur ; « 25' min » → 25'.
  s = s.replace(/(\d+)\s*ou\s*\d+\s*([x×*])/gi, '$1$2').replace(/'\s*mins?\b/gi, "'");
  // « 15'' Z1 + … + 10'' Z1 » en tête ou en fin de séance construite : des minutes (coquille fréquente).
  s = s.replace(/^([^\d+]*?)(\d{2})"\s*(z\s*[12])(?=\s*\+)/i, "$1$2' $3").replace(/(\+\s*)(\d{2})"\s*(z\s*[12])\s*$/i, "$1$2' $3");
  // Séance d’une seule étape « Footing 45'' Z1 » : des minutes.
  if (!/[+×*]/.test(s)) s = s.replace(/(^|\s)([1-9]\d)"(?=\s*(?:z\s*\d|[a-zà-ÿ]|$))/i, "$1$2'");
  // Allure entre parenthèses : « (8:30-9:00) ».
  s = s.replace(/\(\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(?:\/\s*km)?\s*\)/g, (_m, a, b, c, d) => paceText(a, b, c, d));
  // Estimations et totaux entre parenthèses : « (~7 km) », « (≈ 45') », « (20') », « (1h04) ».
  s = s.replace(/\(\s*[~≈][^()]*\)/g, ' ').replace(/\(\s*\d+\s*(?:'|min|h\d*)\s*\)/gi, ' ');
  // Séparateurs écrits en toutes lettres.
  s = s.replace(/,?\s+puis\s+/gi, ' + ');
  // Distances : « 1k » → 1km, « 2km5 » → 2,5km.
  s = s.replace(/(\d)\s*k(?![a-zà-ÿ])/gi, '$1km').replace(/(\d+)km(\d)(?![\d'":,.])/gi, '$1,$2km');
  // Zones en fourchette : « Z1-2 », « Z1-Z2 » → la plus haute ; « EF » = endurance fondamentale (Z2).
  // D-087 : dans l’échelle des documents du fondateur, « Z1-2 » et « Z1 » = Z2 (endurance), puis un cran plus haut.
  s = s.replace(/\bZ\s*(\d)(?:\s*-\s*Z?\s*(\d))?\b/gi, (_m, a: string, b?: string) => {
    const top = Number(b ?? a);
    if (!opts.shiftedZones) return `Z${top}`;
    return `Z${Math.min(7, top <= 2 && Number(a) === 1 ? 2 : top + 1)}`;
  })
    .replace(/(?<![a-zà-ÿ])(?:ef|e\.f\.?)\s+(?=[^+]*?\bZ\s*\d)/gi, '').replace(/(?<![a-zà-ÿ])(?:ef|e\.f\.?)(?![a-zà-ÿ])/gi, 'Z2');
  // Durée en fourchette « 30-35' » : la plus courte, l’autre en note.
  s = s.replace(/(?<![\d':])(\d+)\s*-\s*(\d+)\s*'(?!\d)/g, "$1' jusqu'à $2'");
  // Allures écrites « 4:50/km », « à 7:45-8:00/km », « à 4:50 ».
  s = s.replace(/(?:(?<![a-zà-ÿ])à\s*|@\s*)?(\d{1,2})[:'](\d{2})(?:\s*-\s*(?:(\d{1,2})[:'])?(\d{2}))?\s*(?:min)?\s*\/\s*km/gi, (_m, a, b, c, d) => paceText(a, b, c, d));
  s = s.replace(/(?<![a-zà-ÿ])à\s*(\d{1,2})[:'](\d{2})(?:\s*-\s*(?:(\d{1,2})[:'])?(\d{2}))?(?![\d\/])/gi, (_m, a, b, c, d) => paceText(a, b, c, d));
  // Distance suivie d’un temps : allure (« 2km 4'40 ») ou temps de passage d’une fraction courte (« 400m 1'25" »).
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*(km|m)((?:\s+(?:up|down|en\s+côte|côte|montée))?)\s+(\d{1,2})[:'](\d{2})"?(?:\s*-\s*(?:(\d{1,2})[:'])?(\d{2}))?(?![\d'"])/gi,
    (_m, v: string, u: string, w: string, a: string, b: string, c?: string, d?: string) => {
      const meters = u.toLowerCase() === 'km' ? Number(v.replace(',', '.')) * 1000 : Number(v);
      const t1 = Number(a) * 60 + Number(b);
      if (meters > 0 && meters < 1000 && t1 < 150) {
        const per = Math.round((t1 * 1000) / meters);
        return `${v}${u}${w} @${Math.floor(per / 60)}'${p2(per % 60)}/km`;
      }
      return `${v}${u}${w} ${paceText(a, b, c, d)}`;
    });
  // Durée suivie d’une allure : « 12' 4:55 ».
  s = s.replace(/(\d+\s*(?:'|"|min|h\d*))\s+(\d{1,2}):(\d{2})(?:\s*-\s*(?:(\d{1,2}):)?(\d{2}))?(?![\d'"\/])/gi, (_m, t, a, b, c, d) => `${t} ${paceText(a, b, c, d)}`);
  // Récupération en fin de répétition : « 6x800m @… (récup 1'30) », « 2×30' séparés par R2' », « 4*1500m @… R2' ».
  s = s.replace(/(\d+)\s*[x×*]\s*([^()+]+?)\s*\(\s*(?:récup(?:ération)?|recup|r)\s*:?\s*([^()]+?)\s*\)/gi, '$1×($2 + R$3)');
  s = s.replace(/(\d+)\s*[x×*]\s*([^()+]+?)\s+séparée?s?\s+par\s+(R\s*[\d'",.]+(?:k?m)?)/gi, '$1×($2 + $3)');
  s = s.replace(/(\d+)\s*[x×*]\s*(\d[^()+]*?)\s+(R\s*\d[\d'",.]*(?:k?m)?)(?=\s*(?:\+|\)|$))/gi, '$1×($2 + $3)');
  // Récupération collée à l’effort : « (4km @… R500m) » → « (4km @… + R500m) ».
  s = s.replace(/([^+(\s])\s+(R\s*\d[\d'",.]*(?:k?m)?)(?=\s*(?:\)|$))/g, '$1 + $2');
  // Répétition collée à l’étape précédente : « 15' Z2 4*1500m » → « 15' Z2 + 4*1500m ».
  s = s.replace(/([^\s+(,])\s+(\d+\s*[x×*]\s*[\d(])/g, '$1 + $2');
  // « R1 » sans unité = minutes.
  s = s.replace(/\bR\s*(\d+)(?=\s*(?:\+|\)|$))/g, "R$1'");
  // Marques de suivi et jours en fin de ligne : « ok », « Mardi ».
  for (let i = 0; i < 2; i++) s = s.replace(/[\s.!?]+(?:ok|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)[\s.!?]*$/i, ' ');
  return s.replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '');
}

// ---------- Blocs → texte ----------

const pad = (n: number) => String(n).padStart(2, '0');
function fmtTime(s: number): string {
  if (s < 60) return `${s}"`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h && !sec) return `${h}h${m ? pad(m) : ''}`;
  if (!h && !sec) return `${m}'`;
  return `${h * 60 + m}'${pad(sec)}`;
}
const fmtPace = (s: number) => `${Math.floor(s / 60)}'${pad(s % 60)}`;
const rng = (a: number, b: number | null, unit: string) => `${a}${b !== null && b !== a ? `-${b}` : ''}${unit}`;

function fmtMeasure(m: Measure): string {
  if (m.kind === 'time') return fmtTime(m.seconds);
  if (m.kind === 'distance') return m.meters >= 1000 && m.meters % 100 === 0 ? `${String(m.meters / 1000).replace('.', ',')}km` : `${m.meters}m`;
  return 'libre';
}
function fmtIntensity(i: Intensity): string {
  switch (i.kind) {
    case 'zone': return `Z${i.zone}`;
    case 'pace': {
      // Allure : la plus lente d’abord, comme on la lit (« 4'30-4'15 »).
      const slow = i.max ?? i.min, fast = i.min;
      return `@${fmtPace(slow)}${slow !== fast ? `-${fmtPace(fast)}` : ''}/${i.unit === 'per_100m' ? '100m' : 'km'}`;
    }
    case 'rpe': return `RPE${rng(i.min, i.max, '')}`;
    case 'power': return i.unit === 'pct_ftp' ? rng(i.min, i.max, '%FTP') : rng(i.min, i.max, 'W');
    case 'hr': return i.unit === 'bpm' ? rng(i.min, i.max, 'bpm') : rng(i.min, i.max, '%FC');
    default: return '';
  }
}

function fmtStep(s: Step, sport: Sport, inRepeat: boolean, explicit: boolean): string {
  const sp = s.sport && s.sport !== sport ? `${SPORT_WORD[s.sport] ?? ''} ` : '';
  let ph = '';
  if (s.phase === 'recovery') ph = 'R';
  else if (s.phase === 'rest') ph = 'repos ';
  else if (explicit || (inRepeat && s.phase !== 'work') || s.phase === 'other') ph = `${PHASE_WORD[s.phase]} `;
  const intensity = fmtIntensity(s.intensity);
  return `${sp}${ph}${fmtMeasure(s.measure)}${intensity ? ` ${intensity}` : ''}${s.note ? ` « ${s.note} »` : ''}`;
}

function fmtSeq(blocks: Block[], sport: Sport, inRepeat: boolean, explicit: Set<string>, path: string): string {
  return blocks.map((b, i) => {
    const p = `${path}${i}`;
    if (b.type === 'repeat') {
      const inner = fmtSeq(b.steps, sport, true, explicit, `${p}.`);
      return b.steps.length === 1 && b.steps[0]!.type === 'step' ? `${b.times}×${inner}` : `${b.times}×(${inner})`;
    }
    return fmtStep(b, sport, inRepeat, explicit.has(p));
  }).join(' + ');
}

function phasesDiffer(a: Block[], b: Block[], path: string, out: Set<string>) {
  a.forEach((x, i) => {
    const y = b[i];
    const p = `${path}${i}`;
    if (!y) return;
    if (x.type === 'repeat' && y.type === 'repeat') phasesDiffer(x.steps, y.steps, `${p}.`, out);
    else if (x.type === 'step' && y.type === 'step' && x.phase !== y.phase) out.add(p);
  });
}

/** Blocs → texte relisible par `parseNotation` (phases écrites seulement quand elles ne se déduisent pas). */
export function toNotation(blocks: Block[], sport: Sport): string {
  const explicit = new Set<string>();
  const first = fmtSeq(blocks, sport, false, explicit, '');
  phasesDiffer(blocks, parseNotation(first, sport).blocks, '', explicit);
  return explicit.size ? fmtSeq(blocks, sport, false, explicit, '') : first;
}
