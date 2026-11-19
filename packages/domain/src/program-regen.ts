import { z } from 'zod';
import { addDays, isLocalDate, type LocalDate } from './dates';
import { PROGRAM_PHASE_LABELS, programTweaksSchema, type Program, type ProgramPhase, type ProgramSession, type ProgramWeek } from './program';
import { structureTotals, type Block } from './structure';

/**
 * Régénération partielle d’un programme (CE-P-06, D-063). Complément du fondateur : « régénérer uniquement la partie
 * demandée, présenter les différences et protéger les séances passées et déjà réalisées ».
 * Le calcul est pur : il compare les séances du programme en base aux séances recalculées, semaine par semaine.
 * Sont protégées (jamais touchées) : les séances passées, celles qui ont un retour de l’élève, celles retouchées par le coach.
 */

export type ProtectReason = 'past' | 'done' | 'edited';
export const PROTECT_LABELS: Record<ProtectReason, string> = {
  past: 'passée', done: 'réalisée par l’élève', edited: 'retouchée par toi',
};

/** Séance du programme telle qu’elle est en base (révision de travail). */
export interface PlannedSession {
  id: string; revision: number; date: LocalDate; title: string; blocks: Block[];
  canceled: boolean; done: boolean;
  /** Révision de travail différente de celle écrite par le générateur : le coach l’a modifiée. */
  edited: boolean;
  /** Une version est publiée : la nouvelle restera à publier. */
  published: boolean;
}

type Before = Pick<PlannedSession, 'id' | 'revision' | 'title' | 'published'> & {
  /** Durée des blocs (temps seulement), pour montrer ce qui change quand le titre reste le même. */
  minutes: number;
};
export type RegenItem =
  | { kind: 'kept'; date: LocalDate; before: Before; reason: ProtectReason; dropped: string | null }
  | { kind: 'same'; date: LocalDate; before: Before }
  | { kind: 'changed'; date: LocalDate; before: Before; after: ProgramSession }
  | { kind: 'added'; date: LocalDate; after: ProgramSession }
  | { kind: 'removed'; date: LocalDate; before: Before };
export interface RegenWeek { index: number; monday: LocalDate; phase: ProgramPhase | null; items: RegenItem[] }
export interface Regeneration {
  weeks: RegenWeek[];
  counts: { kept: number; same: number; changed: number; added: number; removed: number };
}

/** Clé d’un changement proposé, pour le choix séance par séance (D-078) : séance existante ou jour ajouté. */
export function regenItemKey(it: RegenItem): string | null {
  if (it.kind === 'changed' || it.kind === 'removed') return it.before.id;
  if (it.kind === 'added') return `add:${it.date}`;
  return null;
}

/** Changements que le coach applique : tous, sauf ceux qu’il a décochés. */
export function chosenCounts(regen: Regeneration, skip: ReadonlySet<string>): { changed: number; added: number; removed: number } {
  const c = { changed: 0, added: 0, removed: 0 };
  for (const it of regen.weeks.flatMap((w) => w.items)) {
    const k = regenItemKey(it);
    if (k && !skip.has(k) && (it.kind === 'changed' || it.kind === 'added' || it.kind === 'removed')) c[it.kind]++;
  }
  return c;
}

export function weekIndexOf(startMonday: LocalDate, date: LocalDate): number {
  const ms = Date.parse(`${date}T12:00:00Z`) - Date.parse(`${startMonday}T12:00:00Z`);
  return Math.floor(Math.round(ms / 86_400_000) / 7) + 1;
}

/** Nombre de semaines couvertes par le programme en base ou recalculé. */
export function regenWeekCount(old: PlannedSession[], program: Program, startMonday: LocalDate): number {
  return Math.max(program.weeks.length, ...old.map((s) => weekIndexOf(startMonday, s.date)));
}

/** Comparaison indépendante de l’ordre des clés (la base réordonne les objets JSON). */
const canon = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
};
const sameContent = (a: { title: string; blocks: Block[] }, b: { title: string; blocks: Block[] }) =>
  a.title === b.title && canon(a.blocks) === canon(b.blocks);

export function planRegeneration(input: {
  old: PlannedSession[]; program: Program; startMonday: LocalDate; fromWeek: number; toWeek: number; today: LocalDate;
}): Regeneration {
  const { old, program, startMonday, fromWeek, toWeek, today } = input;
  const weeks: RegenWeek[] = [];
  const counts = { kept: 0, same: 0, changed: 0, added: 0, removed: 0 };
  for (let i = fromWeek; i <= toWeek; i++) {
    const monday = addDays(startMonday, (i - 1) * 7);
    const pw: ProgramWeek | undefined = program.weeks[i - 1];
    const fresh = [...(pw?.sessions ?? [])];
    const mine = old.filter((s) => !s.canceled && weekIndexOf(startMonday, s.date) === i).sort((a, b) => a.date.localeCompare(b.date));
    const items: RegenItem[] = [];
    const take = (date: LocalDate) => {
      const k = fresh.findIndex((s) => s.date === date);
      return k >= 0 ? fresh.splice(k, 1)[0]! : null;
    };
    for (const s of mine) {
      const before: Before = { id: s.id, revision: s.revision, title: s.title, published: s.published, minutes: Math.round(structureTotals(s.blocks).seconds / 60) };
      const reason: ProtectReason | null = s.date < today ? 'past' : s.done ? 'done' : s.edited ? 'edited' : null;
      if (reason) {
        // La séance recalculée pour ce jour n’est pas ajoutée : la séance protégée garde sa place.
        const n = take(s.date);
        items.push({ kind: 'kept', date: s.date, before, reason, dropped: n && !sameContent(n, s) ? n.title : null });
        continue;
      }
      const n = take(s.date);
      if (!n) items.push({ kind: 'removed', date: s.date, before });
      else if (sameContent(n, s)) items.push({ kind: 'same', date: s.date, before });
      else items.push({ kind: 'changed', date: s.date, before, after: n });
    }
    // Séances recalculées sur un jour libre ; jamais dans le passé.
    for (const n of fresh) if (n.date >= today) items.push({ kind: 'added', date: n.date, after: n });
    items.sort((a, b) => a.date.localeCompare(b.date));
    for (const it of items) counts[it.kind]++;
    weeks.push({ index: i, monday, phase: pw?.phase ?? null, items });
  }
  return { weeks, counts };
}

/** Titre d’une phase pour une ou plusieurs semaines. */
export function programPhaseTitle(p: ProgramPhase, from: number, to: number): string {
  const name = PROGRAM_PHASE_LABELS[p];
  return from === to ? `${name} (semaine ${from})` : `${name} (semaines ${from} à ${to})`;
}

/** Consignes écrites dans un brouillon du programme (D-062) : semaine, raison, consignes de la bibliothèque. */
export function programInstructions(week: Pick<ProgramWeek, 'index' | 'phase'>, s: Pick<ProgramSession, 'why' | 'instructions'>): string {
  return [`Semaine ${week.index} · ${programPhaseTitle(week.phase, week.index, week.index)}`, `Pourquoi cette séance ? ${s.why}`, s.instructions]
    .filter(Boolean).join('\n\n').slice(0, 5000);
}

/** Régénérer une partie (POST …/plans/{pid}/regenerate). L’aperçu vu (séances et révisions) doit être encore valable. */
export const regenerateProgramSchema = z
  .object({
    fromWeek: z.number().int().min(1).max(60),
    toWeek: z.number().int().min(1).max(60),
    days: z.array(z.number().int().min(1).max(7)).min(2, { message: 'Au moins 2 jours' }).max(6, { message: '6 jours au plus' })
      .refine((d) => new Set(d).size === d.length, { message: 'Jour en double' }),
    seen: z.array(z.object({ id: z.string().uuid(), revision: z.number().int().min(1) }).strict()).max(400),
    acceptRisks: z.boolean().default(false),
    /** D-078 : changements décochés par le coach (clés de regenItemKey) ; ils ne sont pas appliqués. */
    skip: z.array(z.string().max(60)).max(400).default([]),
    tweaks: programTweaksSchema.nullish().transform((v) => v ?? null),
    suggestionId: z.string().uuid().nullish().transform((v) => v ?? null),
  })
  .strict()
  .refine((v) => v.fromWeek <= v.toWeek, { message: 'Semaines dans le désordre', path: ['toWeek'] });
export type RegenerateProgramInput = z.output<typeof regenerateProgramSchema>;
