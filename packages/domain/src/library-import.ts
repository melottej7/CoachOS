import { z } from 'zod';
import { createTemplateSchema, LIBRARY_CATEGORIES, LIBRARY_CATEGORY_LABELS, type LibraryCategory, type LibraryWorkout } from './library';
import { parseNotation } from './notation';
import { SPORTS, type Sport } from './sports';
import { structureTotals, type Block } from './structure';

/**
 * Import de la base d’un coach (CE-B-06, CE-B-07, D-079). Le coach colle ou dépose ses séances : un tableau
 * (CSV, ou des cellules copiées d’un tableur) ou des lignes « Titre : séance en notation texte » (D-041).
 * Le calcul est pur : il lit, reconnaît les colonnes, convertit et signale chaque erreur à sa ligne.
 * Rien n’est perdu en silence : une séance illisible reste dans l’aperçu avec son erreur et n’est pas importée.
 */

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_CHARS = 300_000;

export interface ImportRow {
  /** Ligne du fichier (1 = première ligne, en-tête compris). */
  line: number;
  title: string;
  category: LibraryCategory;
  /** La catégorie vient du fichier ; sinon elle est devinée d’après le titre. */
  categoryGuessed: boolean;
  workout: LibraryWorkout | null;
  errors: string[];
  /** Même titre plus haut dans le fichier, ou déjà dans la bibliothèque. */
  duplicate: 'file' | 'library' | null;
  minutes: number | null;
}

export interface ImportPreview {
  format: 'table' | 'lines';
  separator: string | null;
  /** Colonnes reconnues (nom lu → rôle). */
  columns: { header: string; role: Role | null }[];
  rows: ImportRow[];
  /** Erreurs générales (fichier vide, trop long…). */
  errors: string[];
}

type Role = 'title' | 'sport' | 'category' | 'structure' | 'instructions' | 'duration' | 'distance';
export const IMPORT_ROLE_LABELS: Record<Role, string> = {
  title: 'Titre', sport: 'Sport', category: 'Catégorie', structure: 'Séance', instructions: 'Consignes', duration: 'Durée', distance: 'Distance',
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

const HEADER_WORDS: [Role, string[]][] = [
  ['title', ['titre', 'title', 'nom', 'name', 'seance nom', 'intitule', 'libelle']],
  ['sport', ['sport', 'discipline', 'activite', 'activity']],
  ['category', ['categorie', 'category', 'type', 'famille', 'genre', 'theme']],
  ['structure', ['seance', 'structure', 'contenu', 'notation', 'detail', 'workout', 'corps', 'plan', 'programme', 'deroule']],
  ['instructions', ['consignes', 'consigne', 'instructions', 'description', 'notes', 'note', 'commentaire', 'commentaires', 'remarques']],
  ['duration', ['duree', 'duration', 'temps', 'minutes', 'min']],
  ['distance', ['distance', 'km', 'kilometres', 'metres']],
];
function roleOf(header: string): Role | null {
  const h = norm(header);
  if (!h) return null;
  for (const [role, words] of HEADER_WORDS) if (words.includes(h)) return role;
  for (const [role, words] of HEADER_WORDS) if (words.some((w) => w.length > 3 && h.startsWith(w))) return role;
  return null;
}

const SPORT_WORDS: [Sport, string[]][] = [
  ['running', ['course', 'course a pied', 'cap', 'running', 'run', 'footing', 'route']],
  ['trail', ['trail']],
  ['cycling', ['velo', 'cyclisme', 'cycling', 'bike', 'vtt', 'home trainer', 'ht']],
  ['swimming', ['natation', 'nage', 'swim', 'swimming', 'piscine']],
  ['triathlon', ['triathlon', 'tri']],
  ['duathlon', ['duathlon']],
];
export function sportOf(text: string): Sport | null {
  const t = norm(text);
  if (!t) return null;
  if ((SPORTS as readonly string[]).includes(t)) return t as Sport;
  for (const [s, words] of SPORT_WORDS) if (words.includes(t)) return s;
  return null;
}

/** Mots du titre ou de la colonne catégorie → catégorie de la bibliothèque (ordre : le plus précis d’abord). */
const CATEGORY_WORDS: [LibraryCategory, RegExp][] = [
  ['recovery', /\b(recup|recuperation|regeneration|decrassage|recovery)\b/],
  ['long', /\b(sortie longue|sl|long run|longue|long)\b/],
  ['hills', /\b(cote|cotes|montee|hill|hills|denivele)\b/],
  ['threshold', /\b(seuil|threshold|lactique|sweet spot|ftp)\b/],
  ['intervals', /\b(vma|pma|fractionne|fractionnes|intervalles|intervals|30 30|series|piste|400|200|1000|pyramide|repetitions)\b/],
  ['tempo', /\b(tempo|allure marathon|allure specifique|allure semi)\b/],
  ['race', /\b(course|competition|test|race|chrono|objectif)\b/],
  ['strength', /\b(renfo|renforcement|ppg|gainage|musculation|force|strength)\b/],
  ['technique', /\b(technique|educatifs|gammes|drills|educatif)\b/],
  ['endurance', /\b(footing|endurance|ef|aerobie|easy|jogging|z2|base)\b/],
];
export function categoryOf(text: string): LibraryCategory | null {
  const t = norm(text);
  if (!t) return null;
  for (const c of LIBRARY_CATEGORIES) if (norm(LIBRARY_CATEGORY_LABELS[c]) === t || c === t) return c;
  for (const [c, re] of CATEGORY_WORDS) if (re.test(t)) return c;
  return null;
}

/** Durée lue dans une cellule : « 45 », « 45 min », « 1h10 », « 1:10:00 », « 50' ». */
export function minutesOf(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  let m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (m) return m[3] !== undefined ? Number(m[1]) * 60 + Number(m[2]) + Math.round(Number(m[3]) / 60) : Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+)\s*h\s*(\d{1,2})?\s*(?:min|')?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d+(?:\.\d+)?)\s*(?:min|mn|minutes|')?$/.exec(t);
  if (m) return Math.round(Number(m[1]));
  return null;
}
/** Distance en mètres : « 10 », « 10 km », « 800 m », « 12,5km ». Un nombre seul vaut des kilomètres s’il est petit. */
export function metersOf(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  const m = /^(\d+(?:\.\d+)?)\s*(km|m)?$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(m[2] === 'm' || (!m[2] && n > 200) ? n : n * 1000);
}

/** Lecture d’un tableau délimité, guillemets doubles compris (RFC 4180), retours à la ligne dans une cellule acceptés. */
export function splitTable(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += ch;
    } else if (ch === '"' && cell.trim() === '') { quoted = true; cell = ''; }
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

function detectSeparator(text: string): string | null {
  const head = text.split('\n').slice(0, 5);
  for (const sep of ['\t', ';', ',', '|']) {
    const counts = head.filter((l) => l.trim()).map((l) => l.split(sep).length - 1);
    if (counts.length && counts[0]! >= 1 && counts.every((c) => c >= 1)) {
      // Une virgule dans « 1,5km » ne suffit pas : il faut un en-tête reconnu.
      if (sep === ',' || sep === '|') {
        const roles = splitTable(head[0]!, sep)[0]!.map(roleOf);
        if (!roles.includes('title')) continue;
      }
      return sep;
    }
  }
  return null;
}

interface Raw { line: number; title: string; sport: string; category: string; structure: string; instructions: string; duration: string; distance: string }

/**
 * Aperçu de l’import. `existing` : titres déjà dans la bibliothèque (minuscules). `defaultSport` : sport quand la
 * ligne n’en dit rien.
 */
export function previewImport(text: string, opts: { defaultSport: Sport; existing?: Iterable<string> }): ImportPreview {
  const errors: string[] = [];
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!src.trim()) return { format: 'lines', separator: null, columns: [], rows: [], errors: ['Rien à importer : colle tes séances ou choisis un fichier.'] };
  if (src.length > IMPORT_MAX_CHARS) return { format: 'lines', separator: null, columns: [], rows: [], errors: [`Fichier trop long (${Math.round(IMPORT_MAX_CHARS / 1000)}000 caractères au plus) : coupe-le en plusieurs imports.`] };

  const sep = detectSeparator(src);
  let raws: Raw[] = [];
  let columns: ImportPreview['columns'] = [];
  let format: ImportPreview['format'] = 'lines';
  if (sep) {
    const table = splitTable(src, sep);
    const header = table[0] ?? [];
    const roles = header.map(roleOf);
    if (roles.includes('title')) {
      format = 'table';
      columns = header.map((h, i) => ({ header: h, role: roles[i] ?? null }));
      // Une colonne par rôle : la première reconnue.
      const at = (role: Role) => roles.indexOf(role);
      const cell = (r: string[], role: Role) => (at(role) >= 0 ? r[at(role)] ?? '' : '');
      // Numéro de ligne réel (une cellule peut contenir des retours à la ligne).
      let line = 1 + (header.join(sep).match(/\n/g)?.length ?? 0);
      for (const r of table.slice(1)) {
        line++;
        const extra = r.join(sep).match(/\n/g)?.length ?? 0;
        if (r.every((c) => !c)) { line += extra; continue; }
        raws.push({ line, title: cell(r, 'title'), sport: cell(r, 'sport'), category: cell(r, 'category'), structure: cell(r, 'structure'),
          instructions: cell(r, 'instructions'), duration: cell(r, 'duration'), distance: cell(r, 'distance') });
        line += extra;
      }
    } else errors.push('Première ligne sans colonne « Titre » : le texte est lu ligne par ligne.');
  }
  if (format === 'lines') {
    raws = [];
    src.split('\n').forEach((l, i) => {
      const t = l.trim();
      if (!t || t.startsWith('#')) return;
      // « Titre : séance » ou « Titre | séance » ; sinon la ligne entière est la séance et sert aussi de titre.
      const m = /^(.+?)\s*(?::|\||—|–)\s+(.+)$/.exec(t);
      raws.push({ line: i + 1, title: m ? m[1]! : t, sport: '', category: '', structure: m ? m[2]! : t, instructions: '', duration: '', distance: '' });
    });
  }
  if (raws.length > IMPORT_MAX_ROWS) {
    errors.push(`${raws.length} séances : seules les ${IMPORT_MAX_ROWS} premières sont lues. Importe le reste ensuite.`);
    raws = raws.slice(0, IMPORT_MAX_ROWS);
  }

  const seen = new Set<string>();
  const existing = new Set([...(opts.existing ?? [])].map((t) => t.toLowerCase()));
  const rows: ImportRow[] = raws.map((r) => {
    const errs: string[] = [];
    const title = r.title.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!title) errs.push('Titre manquant');
    let sport = opts.defaultSport;
    if (r.sport.trim()) {
      const s = sportOf(r.sport);
      if (s) sport = s; else errs.push(`Sport inconnu : « ${r.sport} »`);
    }
    const fromCol = r.category.trim() ? categoryOf(r.category) : null;
    const guess = categoryOf(`${title} ${r.structure}`);
    const category = fromCol ?? guess ?? 'other';
    let blocks: Block[] = [];
    let instructions = r.instructions.trim();
    if (r.structure.trim()) {
      const n = parseNotation(r.structure, sport);
      if (n.errors.length) {
        // Séance en texte libre : gardée telle quelle dans les consignes, sans structure.
        if (format === 'lines' && r.structure === r.title) errs.push('Séance non reconnue : écris « Titre : séance » (ex. « Footing : 45\' Z2 ») ou la séance en notation de l’éditeur');
        else instructions = [r.structure.trim(), instructions].filter(Boolean).join('\n\n');
      } else blocks = n.blocks;
    }
    const dur = r.duration.trim() ? minutesOf(r.duration) : null;
    if (r.duration.trim() && dur === null) errs.push(`Durée illisible : « ${r.duration} »`);
    const dist = r.distance.trim() ? metersOf(r.distance) : null;
    if (r.distance.trim() && dist === null) errs.push(`Distance illisible : « ${r.distance} »`);
    if (!errs.length && !blocks.length && !instructions && dur === null && dist === null) errs.push('Séance vide : ni structure, ni consignes, ni durée');
    const key = title.toLowerCase();
    const duplicate = !title ? null : existing.has(key) ? 'library' : seen.has(key) ? 'file' : null;
    if (title) seen.add(key);
    let workout: LibraryWorkout | null = null;
    if (!errs.length) {
      const parsed = createTemplateSchema.safeParse({ category, workout: {
        sport, title, instructions: instructions ? instructions.slice(0, 5000) : null,
        durationSeconds: blocks.length ? null : dur !== null ? dur * 60 : null, distanceM: blocks.length ? null : dist, intervals: blocks,
      } });
      if (parsed.success) workout = parsed.data.workout;
      else errs.push(parsed.error.issues[0]?.message ?? 'Séance invalide');
    }
    const secs = workout ? (workout.intervals.length ? structureTotals(workout.intervals).seconds : workout.durationSeconds ?? 0) : 0;
    return { line: r.line, title, category, categoryGuessed: !fromCol, workout, errors: errs, duplicate, minutes: secs ? Math.round(secs / 60) : null };
  });
  if (!rows.length && !errors.length) errors.push('Aucune séance trouvée.');
  return { format, separator: sep, columns, rows, errors };
}

/** Exemple montré au coach : un tableau minimal, en CSV point-virgule (Excel en français). */
export const IMPORT_EXAMPLE = [
  'Titre;Sport;Catégorie;Séance;Consignes',
  'Footing facile;course;Endurance;45\' Z2;Sur terrain plat',
  'VMA courte;course;Fractionné;20\' Z1 + 10×(30" Z6 + R30") + 10\' Z1;',
  'Seuil 3×8;course;Seuil;20\' Z1 + 3×(8\' Z4 + R2\') + 10\' Z1;Récupération en trottinant',
  'Sortie vélo endurance;vélo;Endurance;2h Z2;',
].join('\n');

/** Corps de la commande d’import : les séances retenues dans l’aperçu. */
export const importLibrarySchema = z
  .object({ items: z.array(createTemplateSchema).min(1, { message: 'Aucune séance à importer' }).max(IMPORT_MAX_ROWS) })
  .strict();
export type ImportLibraryInput = z.output<typeof importLibrarySchema>;
