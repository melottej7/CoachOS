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
  [/^(?:vélo|velo)\b/i, 'cycling'],
  [/^(?:course|cap)\b/i, 'running'],
  [/^trail\b/i, 'trail'],
  [/^(?:natation|nat)\b/i, 'swimming'],
];
const SPORT_WORD: Partial<Record<Sport, string>> = { cycling: 'vélo', running: 'course', trail: 'trail', swimming: 'natation' };
const PHASE_WORDS: [RegExp, Phase][] = [
  [/^(?:échauffement|echauffement|échauf|echauf)\b/i, 'warmup'],
  [/^(?:retour au calme|calme|rac)\b/i, 'cooldown'],
  [/^(?:récupération|recuperation|récup|recup)\b/i, 'recovery'],
  [/^repos\b/i, 'rest'],
  [/^(?:effort)\b/i, 'work'],
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
  if ((m = t.match(/^(\d+)\s*(?:'|’|min|mn)\s*(\d{1,2})?\s*(?:"|”|s\b)?/i))) {
    return { measure: { kind: 'time', seconds: mmss(m[1]!, m[2] ?? '0') }, rest: t.slice(m[0].length) };
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

/** Une étape ; `phase` est null quand elle doit être déduite de sa place. */
function parseStep(raw: string, errors: NotationError[]): (Step & { implicit: boolean }) | null {
  let t = raw.trim();
  let note: string | null = null;
  const q = t.match(/[«"]\s*([^»"]*?)\s*[»"]\s*$/);
  if (q) { note = q[1]!.slice(0, 200) || null; t = t.slice(0, q.index).trim(); }
  let sport: Sport | null = null;
  for (const [re, s] of SPORT_WORDS) { const m = t.match(re); if (m) { sport = s; t = t.slice(m[0].length).replace(/^\s*:?\s*/, ''); break; } }
  let phase: Phase | null = null;
  for (const [re, p] of PHASE_WORDS) { const m = t.match(re); if (m) { phase = p; t = t.slice(m[0].length).replace(/^\s*:?\s*/, ''); break; } }
  if (!phase && /^r\s*(?=\d)/i.test(t)) { phase = 'recovery'; t = t.replace(/^r\s*/i, ''); }
  const meas = parseMeasure(t);
  if (!meas) {
    errors.push({ item: raw, message: `« ${raw || '…'} » : durée ou distance attendue au début (ex. 15', 1h30, 400m, 10km)` });
    return null;
  }
  const { intensity, rest } = parseIntensity(meas.rest);
  const left = rest.replace(/[\s,;·]+/g, ' ').trim();
  if (left) errors.push({ item: raw, message: `« ${left} » non compris dans « ${raw} » (une note s’écrit entre « »)` });
  if (meas.measure.kind === 'time' && (meas.measure.seconds < 1 || meas.measure.seconds > 86400)) errors.push({ item: raw, message: `« ${raw} » : durée hors limites` });
  if (meas.measure.kind === 'distance' && (meas.measure.meters < 1 || meas.measure.meters > 1_000_000)) errors.push({ item: raw, message: `« ${raw} » : distance hors limites` });
  return { type: 'step', phase: phase ?? 'work', implicit: phase === null, sport, measure: meas.measure, intensity, cadence: null, note };
}

type Parsed = (Step & { implicit: boolean }) | { type: 'repeat'; times: number; steps: Parsed[] };

function parseSeq(text: string, depth: number, errors: NotationError[]): Parsed[] {
  const parts = splitTop(text);
  if (!parts) { errors.push({ item: text, message: 'Parenthèses mal fermées' }); return []; }
  const out: Parsed[] = [];
  for (const part of parts) {
    if (!part) { errors.push({ item: text, message: 'Étape vide : un « + » en trop ?' }); continue; }
    const r = part.match(/^(\d+)\s*[x×*]\s*([\s\S]+)$/i);
    if (r) {
      const times = Number(r[1]);
      if (times < 2 || times > 50) errors.push({ item: part, message: `« ${part} » : de 2 à 50 répétitions` });
      if (depth >= 2) { errors.push({ item: part, message: 'Une répétition peut en contenir une autre, pas davantage' }); continue; }
      let inner = r[2]!.trim();
      if (inner.startsWith('(') && inner.endsWith(')') && splitTop(inner.slice(1, -1)) !== null) inner = inner.slice(1, -1);
      const steps = parseSeq(inner, depth + 1, errors);
      if (steps.length) out.push({ type: 'repeat', times: Math.max(2, Math.min(50, times)), steps });
      continue;
    }
    if (part.startsWith('(') && part.endsWith(')')) { out.push(...parseSeq(part.slice(1, -1), depth, errors)); continue; }
    const s = parseStep(part, errors);
    if (s) out.push(s);
  }
  return out;
}

const levelOf = (b: Parsed, sport: Sport): number =>
  b.type === 'repeat' ? Math.max(0, ...b.steps.map((x) => levelOf(x, sport))) : b.intensity.kind === 'none' ? 0 : stepLevel(b, sport).level;

/** Phases déduites : en tête, l’étape moins intense que la suite = échauffement ; en fin, = retour au calme. */
function settle(items: Parsed[], sport: Sport, inRepeat: boolean): Block[] {
  return items.map((b, i) => {
    if (b.type === 'repeat') return { type: 'repeat', times: b.times, steps: settle(b.steps, sport, true) };
    const { implicit, ...step } = b;
    if (!implicit || inRepeat || items.length < 2) return step;
    const me = levelOf(b, sport);
    if (i === 0 && Math.max(...items.slice(1).map((x) => levelOf(x, sport))) > me) return { ...step, phase: 'warmup' };
    if (i === items.length - 1 && Math.max(...items.slice(0, -1).map((x) => levelOf(x, sport))) > me) return { ...step, phase: 'cooldown' };
    return step;
  });
}

/** Texte → blocs, avec les erreurs à corriger (aucune perte silencieuse). */
export function parseNotation(text: string, sport: Sport): NotationResult {
  const errors: NotationError[] = [];
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return { blocks: [], errors };
  const parsed = parseSeq(clean, 0, errors);
  return { blocks: settle(parsed, sport, false), errors };
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
