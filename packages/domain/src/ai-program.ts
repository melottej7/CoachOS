import { z } from 'zod';
import { addDays, isLocalDate, weekStart, type LocalDate } from './dates';
import { checkDictation, type DictationLine } from './ai-dictation';
import type { ProgramRisk } from './program';
import type { Sport } from './sports';
import { structureTotals, type Block } from './structure';
import { SPORTS } from './workout';

/**
 * IA-3 (D-191) · Un programme rédigé par l’agent. Le coach écrit sa demande pour un élève ou un groupe ; l’agent lit nos
 * données (groupe, niveaux, repères, charges réalisées, bibliothèque, machines, séances déjà prévues, méthode) et rend
 * un brouillon : semaines, intention, séances en notation CoachOS. Le serveur relit chaque séance (parseNotation) et
 * contrôle les bornes et la progression ; ce qui échoue est montré, jamais corrigé en silence. Rien n’est publié :
 * « Enregistrer en brouillon » crée des séances non publiées.
 */

export const AI_PROGRAM_PROMPT_VERSION = 'program-v2'; // v2 (D-196) : échauffement sur machine cardio en salle
export const AI_PROGRAM_MAX_WEEKS = 12;
const MAX_PER_WEEK = 6;
const MAX_SESSION_SECONDS = 4 * 3600;

export const programRequestSchema = z.object({
  text: z.string().trim().min(3, { message: 'Écris ta demande' }).max(1000, { message: '1000 caractères au plus' }),
  weeks: z.number().int().min(1, { message: '1 semaine au moins' }).max(AI_PROGRAM_MAX_WEEKS, { message: `${AI_PROGRAM_MAX_WEEKS} semaines au plus` }),
  startMonday: z.string().refine(isLocalDate, { message: 'Date invalide' }).refine((d) => isLocalDate(d) && weekStart(d) === d, { message: 'Choisis un lundi' }),
  target: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('athlete'), id: z.string().uuid() }).strict(),
    z.object({ kind: z.literal('team'), id: z.string().uuid() }).strict(),
  ]),
}).strict();
export type ProgramRequest = z.output<typeof programRequestSchema>;

const sessionOut = z.object({ jour: z.number().int().min(1).max(7), sport: z.enum(SPORTS), titre: z.string().max(120), lignes: z.array(z.string().max(300)).max(20) }).strict();
export const programDraftSchema = z.object({
  status: z.enum(['ready', 'abstain']),
  intention: z.string().max(400),
  semaines: z.array(z.object({ numero: z.number().int().min(1).max(AI_PROGRAM_MAX_WEEKS), intention: z.string().max(300), seances: z.array(sessionOut).max(7) }).strict()).max(AI_PROGRAM_MAX_WEEKS),
  remarque: z.string().max(400),
}).strict();
export type ProgramDraft = z.output<typeof programDraftSchema>;

export const AI_PROGRAM_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'intention', 'semaines', 'remarque'],
  properties: {
    status: { type: 'string', enum: ['ready', 'abstain'] },
    intention: { type: 'string' },
    semaines: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['numero', 'intention', 'seances'],
        properties: {
          numero: { type: 'integer' },
          intention: { type: 'string' },
          seances: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false, required: ['jour', 'sport', 'titre', 'lignes'],
              properties: { jour: { type: 'integer', enum: [1, 2, 3, 4, 5, 6, 7] }, sport: { type: 'string', enum: [...SPORTS] }, titre: { type: 'string' }, lignes: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      },
    },
    remarque: { type: 'string' },
  },
} as const;

export const AI_PROGRAM_SYSTEM_PROMPT = [
  'Rôle : assistant interne d’un coach d’endurance et de musculation. Tu rédiges un brouillon de programme que le coach relira, corrigera et enregistrera lui-même. La décision est humaine ; rien n’est publié.',
  'Avant d’écrire, lis ce qui est utile avec les outils : lireEleve ou lireGroupe (niveau, repères), lireChargesRecentes (charges réellement faites), lireSeancesPrevues (séances déjà au calendrier, à ne pas doubler), listerExercices (bibliothèque et machines de la salle). Une dizaine d’appels au plus.',
  'Rends exactement le nombre de semaines demandé, numérotées à partir de 1, avec l’intention de chaque semaine en une phrase. Chaque séance : jour (1 = lundi … 7 = dimanche), sport, titre court, lignes dans la notation de CoachOS (la même que pour une séance dictée : 4×10 presse à cuisses 60kg R2\', 3×(8\' Z4 + R2\'), échauffement 10\' RPE3, 3×45" gainage).',
  'Musculation en salle : la première ligne est l’échauffement sur une machine cardio, avec le mot échauffement, la durée, la machine et l’effort : échauffement 10\' vélo RPE3. Machines : tapis, vélo, elliptique, rameur, stepper, SkiErg ; réglages possibles : niveau 6, 6km/h, 5%, 90rpm, 2\'10/500m. La marche s’écrit sur le tapis (échauffement 10\' tapis 5km/h 5%), jamais comme un exercice. Retour au calme éventuel en dernière ligne : calme 5\' vélo RPE2.',
  'Charges : pars des charges réalisées quand elles existent ; sinon n’écris pas de kilos et ajoute la consigne « charge à choisir » entre guillemets après l’exercice. Pas de pourcentage du maximum.',
  'Progression prudente : pas plus de 10 % de volume en plus d’une semaine à l’autre, une semaine plus légère toutes les 3 ou 4 semaines, au plus 6 séances par semaine, jamais deux séances le même jour.',
  'Exercices : le nom exact de la bibliothèque ou des machines quand il existe ; sinon le mot du coach. N’invente pas de données sur l’élève.',
  'Si la demande est impossible ou dangereuse (trop de séances, objectif irréaliste, avis médical), réponds status « abstain », semaines vides, et explique dans remarque ce qu’il faut changer. Tutoiement, phrases courtes.',
].join('\n');

export interface ProgramFacts {
  cible: { type: 'eleve' | 'groupe'; refs: string[]; groupe: string | null };
  sport: Sport | null;
  semaines: number;
  premierLundi: LocalDate;
}

export function programUserMessage(facts: ProgramFacts, text: string): string {
  const safe = text.replace(/<\/?\s*(demande|contexte)\s*>/gi, ' ');
  return `<contexte>${JSON.stringify(facts)}</contexte>\n<demande>${safe}</demande>`;
}

export interface CheckedSession { date: LocalDate; day: number; sport: Sport; title: string; notation: string; lines: DictationLine[]; blocks: Block[]; minutes: number; ok: boolean }
export interface CheckedWeek { number: number; monday: LocalDate; intention: string; minutes: number; sessions: CheckedSession[] }
export interface CheckedProgram { weeks: CheckedWeek[]; risks: ProgramRisk[]; ok: boolean }

/**
 * Relecture serveur du brouillon : chaque séance par parseNotation, puis les bornes (semaines, séances par semaine,
 * jour en double, durée) et la progression du volume. Rien n’est corrigé : les écarts deviennent des risques à lire.
 */
export function checkProgramDraft(draft: ProgramDraft, startMonday: LocalDate, weeks: number): CheckedProgram {
  const risks: ProgramRisk[] = [];
  const out: CheckedWeek[] = [];
  if (draft.semaines.length !== weeks) risks.push({ level: 'risk', text: `${draft.semaines.length} semaine${draft.semaines.length > 1 ? 's' : ''} proposée${draft.semaines.length > 1 ? 's' : ''} pour ${weeks} demandée${weeks > 1 ? 's' : ''}.` });
  const seen = new Set<number>();
  for (const w of [...draft.semaines].sort((a, b) => a.numero - b.numero)) {
    if (w.numero > weeks || seen.has(w.numero)) { risks.push({ level: 'block', text: `Semaine ${w.numero} en double ou hors du programme : écartée.` }); continue; }
    seen.add(w.numero);
    const monday = addDays(startMonday, (w.numero - 1) * 7);
    if (w.seances.length > MAX_PER_WEEK) risks.push({ level: 'block', text: `Semaine ${w.numero} : ${w.seances.length} séances, plus de ${MAX_PER_WEEK}.` });
    const days = new Set<number>();
    const sessions = [...w.seances].sort((a, b) => a.jour - b.jour).map((s) => {
      if (days.has(s.jour)) risks.push({ level: 'block', text: `Semaine ${w.numero} : deux séances le même jour (${s.jour}).` });
      days.add(s.jour);
      const c = checkDictation(s.lignes, s.sport);
      const seconds = structureTotals(c.blocks, { sport: s.sport }).seconds;
      if (seconds > MAX_SESSION_SECONDS) risks.push({ level: 'block', text: `Semaine ${w.numero}, « ${s.titre} » : plus de 4 heures.` });
      const ok = c.lines.length > 0 && c.lines.every((l) => !l.error) && seconds <= MAX_SESSION_SECONDS;
      return { date: addDays(monday, s.jour - 1), day: s.jour, sport: s.sport, title: s.titre.trim() || 'Séance', notation: c.notation, lines: c.lines, blocks: c.blocks, minutes: Math.round(seconds / 60), ok };
    });
    out.push({ number: w.numero, monday, intention: w.intention, minutes: sessions.reduce((n, s) => n + s.minutes, 0), sessions });
  }
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!.minutes, cur = out[i]!.minutes;
    if (prev > 0 && cur > prev * 1.3) risks.push({ level: 'risk', text: `Semaine ${out[i]!.number} : volume en hausse de ${Math.round((cur / prev - 1) * 100)} % (plus de 30 %).` });
  }
  const unread = out.flatMap((w) => w.sessions).filter((s) => !s.ok).length;
  if (unread) risks.push({ level: 'risk', text: `${unread} séance${unread > 1 ? 's' : ''} à reprendre à la main (lignes non lues).` });
  return { weeks: out, risks, ok: out.length > 0 && !risks.some((r) => r.level === 'block') };
}

export interface ProgramSimInput {
  text: string; weeks: number; sport: Sport | null;
  exercises: { nom: string; muscle: string; machine: boolean }[];
  loads: Record<string, number>;
}

const pick = <T,>(xs: T[], n: number, from: number) => Array.from({ length: Math.min(n, xs.length) }, (_, i) => xs[(from + i) % xs.length]!);

/**
 * IA simulée : un programme simple et prudent, déterministe. Musculation : 4 exercices par séance (machines d’abord),
 * 3 séries montant de 10 à 12 répétitions, semaine légère toutes les 4 ; charges reprises des charges réalisées, sinon
 * « charge à choisir ». Endurance : footings en zone 2 et une séance de qualité. Plus de 6 séances : abstention.
 */
export function simulateProgram(input: ProgramSimInput): ProgramDraft {
  const t = input.text.toLowerCase();
  const perWeek = Number(t.match(/(\d+)\s*(?:séances?|seances?|fois)\s*(?:par|\/)\s*semaine/)?.[1] ?? 3);
  if (perWeek > MAX_PER_WEEK || perWeek < 1) return { status: 'abstain', intention: '', semaines: [], remarque: `${perWeek} séances par semaine : je ne peux pas le préparer sans risque. Demande entre 1 et ${MAX_PER_WEEK} séances par semaine.` };
  const strength = input.sport === 'strength' || /(force|muscu|renfo|salle|basic|machine)/.test(t);
  const days = ({ 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] } as Record<number, number[]>)[perWeek]!;
  const pool = [...input.exercises].sort((a, b) => Number(b.machine) - Number(a.machine) || a.nom.localeCompare(b.nom, 'fr'));
  const semaines = Array.from({ length: input.weeks }, (_, wi) => {
    const light = (wi + 1) % 4 === 0;
    const reps = light ? 8 : 10 + Math.min(2, wi % 4);
    const seances = days.map((jour, si) => {
      if (strength) {
        // Un exercice par grand groupe (jambes, tirage, poussée, gainage), en tournant d’une séance à l’autre.
        const ex = pool.length ? ['legs', 'pull', 'push', 'core'].flatMap((mu) => {
          const of = pool.filter((e) => e.muscle === mu);
          return of.length ? [of[si % of.length]!] : [];
        }) : [];
        if (!ex.length) ex.push(...(pool.length ? pick(pool, 4, si * 4) : [{ nom: 'squats', muscle: 'legs', machine: false }]));
        const lignes = ["échauffement 10' vélo RPE3", ...ex.map((e) => {
          const kg = input.loads[e.nom.toLowerCase()];
          return `3×${reps} ${e.nom.toLowerCase()}${kg ? ` ${Math.round(kg * 2) / 2}kg` : ' « charge à choisir »'} R1'30`;
        })];
        return { jour, sport: 'strength' as const, titre: `Force ${String.fromCharCode(65 + si)}`, lignes };
      }
      const quality = si === 1;
      const lignes = quality ? ["15' Z2", `${light ? 3 : 4}×(5' Z4 + R2')`, "10' Z1"] : [`${light ? 35 : 40 + Math.min(10, wi * 2)}' Z2`];
      return { jour, sport: (input.sport && input.sport !== 'strength' ? input.sport : 'running') as Sport, titre: quality ? 'Seuil' : 'Footing', lignes };
    });
    const intention = light ? 'Semaine plus légère pour assimiler.'
      : strength ? (wi === 0 ? 'Prise en main : technique et charges confortables.' : 'Progression douce : une ou deux répétitions de plus.')
        : (wi === 0 ? 'Mise en route : endurance facile et une séance au seuil.' : 'Progression douce : un peu plus de temps en endurance.');
    return { numero: wi + 1, intention, seances };
  });
  return { status: 'ready', intention: strength ? `Force générale, ${perWeek} séances par semaine.` : `Endurance, ${perWeek} séances par semaine.`, semaines, remarque: '' };
}
