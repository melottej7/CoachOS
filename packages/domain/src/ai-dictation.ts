import { z } from 'zod';
import { machineOf, parseNotation, type NotationError } from './notation';
import type { Sport } from './sports';
import { ZONE_FTP_PCT, ZONE_TARGET_PCT, type Block, type Zone } from './structure';
import { SPORTS } from './workout';

/**
 * IA-1 (D-189) · Dicter ou écrire une séance. Le coach écrit (ou dicte avec le micro de son téléphone) en langage
 * courant ; l’IA rend des lignes dans NOTRE notation (D-041), chaque exercice nommé comme dans la bibliothèque ou les
 * machines quand il y est. Le serveur relit chaque ligne avec parseNotation : ce qui ne se lit pas est signalé, rien
 * n’est inventé. Le coach corrige le texte, voit l’aperçu et insère dans la séance (brouillon, jamais publié).
 * Aucun audio n’est envoyé : seulement le texte, le sport et les repères de l’élève sans nom.
 */

export const AI_DICTATION_PROMPT_VERSION = 'dictation-v2'; // v2 (D-196) : cardio sur machine
export const DICTATION_MAX_CHARS = 1000;
const MAX_LINES = 30;

export const dictationRequestSchema = z.object({
  text: z.string().trim().min(3, { message: 'Écris ou dicte ta séance' }).max(DICTATION_MAX_CHARS, { message: `${DICTATION_MAX_CHARS} caractères au plus` }),
  sport: z.enum(SPORTS),
  athleteId: z.string().uuid().nullish().transform((v) => v ?? null),
}).strict();
export type DictationRequest = z.output<typeof dictationRequestSchema>;

/** Sortie du modèle, validée avant tout usage. */
export const dictationOutputSchema = z.object({
  status: z.enum(['ready', 'abstain']),
  lignes: z.array(z.string().max(300)).max(MAX_LINES),
  remarque: z.string().max(300),
}).strict();
export type DictationOutput = z.output<typeof dictationOutputSchema>;

export const AI_DICTATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'lignes', 'remarque'],
  properties: {
    status: { type: 'string', enum: ['ready', 'abstain'] },
    lignes: { type: 'array', items: { type: 'string' } },
    remarque: { type: 'string' },
  },
} as const;

const pctTable = (t: Record<Zone, readonly [number, number]>) => (Object.entries(t) as [string, readonly [number, number]][]).map(([z, [lo, hi]]) => `Z${z} ${lo}-${hi} %`).join(', ');

/** Consigne fixe (mise en cache) : la notation de CoachOS, ses exemples et les règles. Aucune donnée variable. */
export const AI_DICTATION_SYSTEM_PROMPT = [
  'Rôle : assistant interne d’un coach d’endurance et de musculation. Tu traduis la séance que le coach écrit ou dicte en langage courant dans la notation de CoachOS, rien d’autre. La décision est humaine.',
  'Rends une liste de lignes ; chaque ligne est un bloc de la séance, dans l’ordre. Notation :',
  '- durées 10\' 1\'30 45" 1h30 ; distances 400m 10km ; intensités Z1 à Z7, @4\'30/km, RPE7, 95%FTP, 250W ;',
  '- répétitions d’un bloc : 3×(8\' Z4 + R2\') où R2\' est la récupération ; repos : « repos 1\'30 » ;',
  '- musculation : 4×10 presse à cuisses 60kg R2\' (4 séries de 10 à 60 kg, 2 min de récupération) ; 3×12 tirage vertical ; 3×45" gainage ; 3×(12 fentes + 30" planche + repos 1\') pour un circuit ;',
  '- échauffement : « échauffement 10\' RPE3 » ; retour au calme : « calme 5\' Z1 » ; une consigne entre guillemets « Dos droit » après l’étape ;',
  '- cardio sur machine en salle : la durée, puis la machine (tapis, vélo, elliptique, rameur, stepper, SkiErg) et ses réglages : « échauffement 10\' vélo RPE3 », « 12\' rameur 2\'10/500m », « 10\' tapis 6km/h 5% » ; la marche en salle s’écrit sur le tapis.',
  `Pourcentages de VMA en course : convertis en zone (${pctTable(ZONE_TARGET_PCT)}). Pourcentages de FTP à vélo : écris 95%FTP ou la zone (${pctTable(ZONE_FTP_PCT)}).`,
  'Exercices : appelle listerExercices pour trouver le nom exact dans la bibliothèque du coach ou parmi les machines ; écris ce nom exact. S’il n’existe pas, garde le mot du coach tel quel : n’invente ni exercice, ni charge, ni durée.',
  'N’ajoute rien que le coach n’a pas dit. Si une partie est ambiguë, écris-la au plus près et signale-la dans remarque (une phrase, tutoiement).',
  'Si la demande ne décrit pas une séance, réponds status « abstain », lignes vides, et dis dans remarque ce qu’il faut préciser. Ne donne aucun avis médical.',
].join('\n');

export interface DictationFacts {
  sport: Sport;
  /** Repères et niveau de l’élève, sans nom (null pour une séance sans élève). */
  eleve: { niveau: string | null; vmaKmh: number | null; ftpW: number | null; cssSecPer100: number | null } | null;
}

/** Message : faits structurés puis le texte du coach dans un bloc balisé (une donnée, jamais une instruction). */
export function dictationUserMessage(facts: DictationFacts, text: string): string {
  const safe = text.replace(/<\/?\s*(demande|contexte)\s*>/gi, ' ');
  return `<contexte>${JSON.stringify(facts)}</contexte>\n<demande>${safe}</demande>`;
}

export interface DictationLine { text: string; error: string | null }
export interface DictationCheck { lines: DictationLine[]; notation: string; blocks: Block[]; exerciseNames: string[] }

const errText = (e: NotationError[]) => (e[0] ? e[0].message : null);
const namesOf = (bs: Block[]): string[] => bs.flatMap((b) => (b.type === 'step' ? (b.exercise ? [b.exercise.name] : []) : namesOf(b.steps)));

/** Relit chaque ligne avec parseNotation : une erreur par ligne illisible ; la notation finale ne garde que les lignes lues. */
export function checkDictation(lines: string[], sport: Sport): DictationCheck {
  const out: DictationLine[] = [];
  const ok: string[] = [];
  const blocks: Block[] = [];
  for (const raw of lines.slice(0, MAX_LINES)) {
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const r = parseNotation(text, sport);
    const error = r.errors.length ? errText(r.errors) : r.blocks.length ? null : 'Ligne vide après lecture';
    out.push({ text, error });
    if (!error) { ok.push(text); blocks.push(...r.blocks); }
  }
  // D-196 : la séance se relit en entier, comme à l’enregistrement : l’échauffement en tête (« 10' vélo ») se déduit de la suite.
  const whole = ok.length > 1 ? parseNotation(ok.join(' + '), sport) : null;
  const settled = whole && !whole.errors.length ? whole.blocks : blocks;
  return { lines: out, notation: ok.join(' + '), blocks: settled, exerciseNames: [...new Set(namesOf(settled))] };
}

/** Zone de course pour un pourcentage de VMA (table du domaine). */
export function zoneForVmaPct(pct: number): Zone {
  const hit = (Object.entries(ZONE_TARGET_PCT) as [string, readonly [number, number]][]).find(([, [lo, hi]]) => pct >= lo && pct <= hi);
  return Number(hit?.[0] ?? (pct < 55 ? 1 : 7)) as Zone;
}

const num = (s: string) => Number(s.replace(',', '.'));
const MIN = '(?:minutes?|min|mn|\')';
const SEC = '(?:secondes?|sec|s|")';
const TIMES = '(?:fois|séries? de|series? de|x|×)';

/** Nom connu le plus proche (même début), sinon le mot du coach. */
function knownName(word: string, known: string[]): string {
  const w = word.trim().toLowerCase();
  const exact = known.find((k) => k.toLowerCase() === w);
  if (exact) return exact;
  const starts = known.filter((k) => k.toLowerCase().startsWith(`${w} `) || k.toLowerCase().startsWith(w)).sort((a, b) => a.length - b.length);
  return starts[0] ?? word.trim();
}

/**
 * IA simulée (sans clé) : un petit lecteur de règles pour les phrases courantes. Ce qu’il ne reconnaît pas reste tel
 * quel : la relecture le signale. Même forme que le modèle, validée de la même façon.
 */
export function simulateDictation(text: string, sport: Sport, known: string[]): DictationOutput {
  const parts = text.replace(/\s+/g, ' ').split(/\s*(?:,|;|\n|\bpuis\b|\bensuite\b|\bet enfin\b)\s*/i).map((p) => p.trim().replace(/^(?:et|puis)\s+/i, '')).filter(Boolean);
  const lines: string[] = [];
  let open: 'strength' | 'interval' | null = null;
  let m: RegExpMatchArray | null;
  for (const p of parts) {
    if ((m = p.match(new RegExp(`^(?:échauffement|echauffement|échauf)\\s+(\\d+)\\s*${MIN}\\s*(.*)$`, 'i')))) {
      // D-196 : en salle, « 10 minutes vélo » est l’échauffement sur la machine.
      const on = m[2] ? m[2].trim().replace(/^(?:de|du|sur|au|en)\s+(?:l[ae']\s*)?/i, '') : '';
      if (sport === 'strength' && on && machineOf(on)) lines.push(`échauffement ${m[1]}' ${on} RPE3`);
      else lines.push(`échauffement ${m[1]}' RPE3${m[2] ? ` « ${m[2].trim()} »` : ''}`);
      open = null;
    } else if ((m = p.match(new RegExp(`^(?:(\\d+)\\s*${MIN}\\s*(?:de\\s+)?(?:repos|récup[ée]ration|récup|recup)|(?:repos|récup[ée]ration|récup|recup)\\s+(?:de\\s+)?(\\d+)\\s*${MIN})$`, 'i')))) {
      const r = m[1] ?? m[2];
      const last = lines.length - 1;
      if (open === 'strength' && last >= 0) lines[last] = `${lines[last]} R${r}'`;
      else if (open === 'interval' && last >= 0) lines[last] = lines[last]!.replace(/\)$/, ` + R${r}')`);
      else lines.push(`repos ${r}'`);
      open = null;
    } else if ((m = p.match(new RegExp(`^(\\d+)\\s*${MIN}\\s*(?:tranquille|facile|cool|en endurance|d[’']endurance|footing)$`, 'i')))) {
      lines.push(`${m[1]}' Z2`); open = null;
    } else if ((m = p.match(new RegExp(`^(\\d+)\\s*${TIMES}\\s*(\\d+)\\s*${MIN}\\s*(?:à|a)\\s*(\\d+)\\s*%\\s*(?:de\\s+)?(?:la\\s+)?vma$`, 'i')))) {
      lines.push(`${m[1]}×(${m[2]}' Z${zoneForVmaPct(num(m[3]!))})`); open = 'interval';
    } else if ((m = p.match(new RegExp(`^(.+?)\\s+(\\d+)\\s*${TIMES}\\s*(\\d+)\\s*${SEC}$`, 'i')))) {
      lines.push(`${m[2]}×${m[3]}" ${knownName(m[1]!, known).toLowerCase()}`); open = 'strength';
    } else if ((m = p.match(new RegExp(`^(.+?)\\s+(\\d+)\\s*${TIMES}\\s*(\\d+)(?:\\s*(?:répétitions|repetitions|reps|rép))?(?:\\s*(?:à|a)\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:kilos?|kg))?$`, 'i')))) {
      lines.push(`${m[2]}×${m[3]} ${knownName(m[1]!, known).toLowerCase()}${m[4] ? ` ${num(m[4])}kg` : ''}`); open = 'strength';
    } else {
      lines.push(p); open = null;
    }
  }
  const unread = lines.filter((l) => parseNotation(l, sport).errors.length).length;
  if (!lines.length) return { status: 'abstain', lignes: [], remarque: 'Je n’ai pas reconnu de séance. Exemple : « échauffement 10 minutes vélo, puis presse 4 séries de 10 à 60 kilos, 2 minutes de repos ».' };
  return { status: 'ready', lignes: lines, remarque: unread ? `${unread} ligne${unread > 1 ? 's' : ''} à reprendre à la main.` : '' };
}
