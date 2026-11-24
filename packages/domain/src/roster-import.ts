import { z } from 'zod';
import { isTimeZone } from './dates';
import { normalizeEmail } from './workspace';

/**
 * Ajouter plusieurs élèves d’un coup (D-169) : une liste collée depuis Google Docs, Google Sheets, Excel ou un e-mail.
 * Une ligne par élève ; le nom, l’adresse (facultative) et le groupe (facultatif) dans l’ordre qu’on veut, séparés par
 * une tabulation, un point-virgule, une virgule, une barre ou un tiret entouré d’espaces. Une ligne d’en-tête
 * (« Prénom ; Nom ; E-mail ; Groupe ») est reconnue et donne l’ordre des colonnes. Un intertitre (« Ultra : », « Groupe B »)
 * donne leur groupe aux lignes qui suivent ; un titre de document (« Mes élèves – saison 2027 ») est écarté, avec sa raison.
 */

export const ROSTER_IMPORT_MAX = 200;
const NAME_MAX = 100;
const GROUP_MAX = 60;
const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const BULLET_RE = /^\s*(?:[-•*·▪◦]|\d{1,3}[.)])\s+/;
/** Intertitre de groupe sans deux-points : « Groupe Ultra », « Niveau 2 », « Équipe B ». */
const GROUP_HEAD_RE = /^(groupe|group|équipe|equipe|niveau|section|catégorie|categorie)\b/i;
/** Ce qui n’est pas un nom : titre du document (« Mes élèves – saison 2027 »), compte, date. */
const TITLE_RE = /(?<!\p{L})(élèves|eleves|athlètes|athletes|clients|clientes|liste|saison|membres|inscrits|planning|programme)(?!\p{L})|\d/iu;

export interface RosterRow {
  /** Numéro de ligne dans le texte collé (à partir de 1). */
  line: number;
  displayName: string;
  email: string | null;
  group: string | null;
}

export interface RosterIssue {
  line: number;
  text: string;
  reason: string;
}

type Column = 'first' | 'last' | 'name' | 'email' | 'group' | 'skip';

function headerColumn(cell: string): Column | null {
  const c = cell.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!c) return 'skip';
  if (/^(prenom|first ?name|firstname)$/.test(c)) return 'first';
  if (/^(nom( de famille)?|last ?name|lastname|surname)$/.test(c)) return 'last';
  if (/^(nom complet|nom et prenom|prenom et nom|eleve|athlete|client|cliente|membre|name|full ?name|identite)$/.test(c)) return 'name';
  if (/^(e-?mail|courriel|adresse( e-?mail)?|mail)$/.test(c)) return 'email';
  if (/^(groupe|group|equipe|niveau|categorie|section|team)$/.test(c)) return 'group';
  return null;
}

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(';')) return line.split(';');
  if (line.includes('|')) return line.split('|');
  if (line.includes(',')) return line.split(',');
  return line.split(/\s+[-–—]\s+/);
}

const clean = (s: string) => s.replace(/^["'«\s]+|["'»\s]+$/g, '').replace(/\s+/g, ' ').trim();

/** Lit le texte collé : lignes retenues et lignes écartées, chacune avec sa raison. Ne lève jamais d’erreur. */
export function parseRoster(text: string): { rows: RosterRow[]; issues: RosterIssue[] } {
  const rows: RosterRow[] = [];
  const issues: RosterIssue[] = [];
  const seenEmail = new Map<string, number>();
  const seenName = new Map<string, number>();
  let header: Column[] | null = null;
  let section: string | null = null;
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  lines.forEach((raw, i) => {
    const line = i + 1;
    const src = raw.replace(BULLET_RE, '').trim();
    if (!src) return;
    const cells = splitCells(src).map(clean);

    // En-tête : uniquement en tête de liste ; au moins deux colonnes connues dont le nom. Les autres colonnes
    // (« Formule », « Téléphone »…) sont ignorées.
    if (!rows.length && !header && !issues.length && cells.length > 1 && !src.includes('@')) {
      const cols = cells.map(headerColumn);
      const known = cols.filter((c) => c !== null && c !== 'skip');
      if (known.length >= 2 && known.some((c) => c === 'first' || c === 'last' || c === 'name')) {
        header = cols.map((c) => c ?? 'skip');
        return;
      }
    }

    // Intertitre de groupe : « Ultra : », « Groupe B » ; il vaut pour les lignes suivantes.
    if (!EMAIL_RE.test(src) && !src.includes('@')) {
      const head = /:\s*$/.test(src) ? src.replace(/\s*:\s*$/, '') : cells.filter(Boolean).length === 1 && GROUP_HEAD_RE.test(src) ? src : null;
      if (head !== null) {
        section = clean(head).slice(0, GROUP_MAX).trim() || null;
        return;
      }
    }

    let first = '';
    let last = '';
    let name = '';
    let email: string | null = null;
    let group = '';
    if (header) {
      header.forEach((col, k) => {
        const v = cells[k] ?? '';
        if (col === 'first') first = v;
        else if (col === 'last') last = v;
        else if (col === 'name') name = v;
        else if (col === 'email') email = EMAIL_RE.exec(v)?.[0] ?? (v ? v : null);
        else if (col === 'group') group = v;
      });
      name = name || [first, last].filter(Boolean).join(' ');
    } else {
      // Sans en-tête : l’adresse est reconnue où qu’elle soit (« Marie Dupont <marie@…> » compris), le reste dans l’ordre.
      const rest: string[] = [];
      for (const cell of cells) {
        const m = EMAIL_RE.exec(cell);
        if (m && !email) {
          email = m[0];
          const left = clean(cell.replace(m[0], '').replace(/[<>()[\]]/g, ' '));
          if (left) rest.push(left);
        } else if (!email && /\S@|@\S/.test(cell) && !/\s/.test(cell)) {
          email = cell; // ressemble à une adresse mal formée : signalée plus bas plutôt que prise pour un nom
        } else if (cell) rest.push(cell);
      }
      name = rest[0] ?? '';
      group = rest[1] ?? '';
    }

    name = clean(name);
    group = clean(group) || section || '';
    if (email === null && name && TITLE_RE.test(name)) {
      issues.push({ line, text: src, reason: 'Ressemble à un titre, pas à un nom' });
      return;
    }
    if (!name && email !== null && !EMAIL_RE.test(email)) {
      issues.push({ line, text: src, reason: 'Adresse e-mail invalide' });
      return;
    }
    if (!name) {
      issues.push({ line, text: src, reason: 'Nom manquant' });
      return;
    }
    if (name.length > NAME_MAX) {
      issues.push({ line, text: src, reason: `Nom de plus de ${NAME_MAX} caractères` });
      return;
    }
    if (email !== null) {
      const e = normalizeEmail(email);
      if (!z.email().safeParse(e).success || e.length > 254) {
        issues.push({ line, text: src, reason: 'Adresse e-mail invalide' });
        return;
      }
      if (seenEmail.has(e)) {
        issues.push({ line, text: src, reason: `Même adresse que la ligne ${seenEmail.get(e)}` });
        return;
      }
      seenEmail.set(e, line);
      email = e;
    }
    const key = name.toLowerCase();
    if (seenName.has(key) && email === null) {
      issues.push({ line, text: src, reason: `Même nom que la ligne ${seenName.get(key)}, sans adresse pour les distinguer` });
      return;
    }
    seenName.set(key, line);
    if (group.length > GROUP_MAX) group = group.slice(0, GROUP_MAX).trim();
    if (rows.length >= ROSTER_IMPORT_MAX) {
      issues.push({ line, text: src, reason: `Au-delà de ${ROSTER_IMPORT_MAX} élèves par ajout` });
      return;
    }
    rows.push({ line, displayName: name, email, group: group || null });
  });

  return { rows, issues };
}

const optionalText = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(max))
    .nullish()
    .transform((v) => (v ? v : null));

/** POST /workspaces/{wid}/athletes/import (D-169). Les lignes viennent de parseRoster, relues par le coach. */
export const importRosterSchema = z
  .object({
    timeZone: z.string().max(80).refine(isTimeZone, { message: 'Fuseau horaire inconnu' }),
    rows: z
      .array(
        z
          .object({
            displayName: z
              .string()
              .transform((v) => v.trim())
              .pipe(z.string().min(1, { message: 'Saisir le nom de l’élève' }).max(NAME_MAX)),
            email: z
              .string()
              .transform(normalizeEmail)
              .pipe(z.email({ message: 'Adresse e-mail invalide' }).max(254))
              .nullish()
              .transform((v) => v ?? null),
            group: optionalText(GROUP_MAX),
          })
          .strict(),
      )
      .min(1, { message: 'Ajoute au moins un élève' })
      .max(ROSTER_IMPORT_MAX, { message: `${ROSTER_IMPORT_MAX} élèves au plus par ajout` }),
  })
  .strict();
