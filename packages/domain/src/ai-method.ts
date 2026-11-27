import { z } from 'zod';
import { METHOD_NOTE_INFO, METHOD_NOTE_KEYS, type MethodNoteKey, type MethodNotes } from './coach-method';

/**
 * IA-2 (D-190) · « Proposer depuis ma bibliothèque » : l’IA lit 10 à 20 séances écrites par le coach et propose sa
 * méthode en six champs courts. Le coach reprend, corrige ou écarte ; rien n’est enregistré sans son geste. La méthode
 * acceptée est ensuite lue par l’IA (bloc balisé après la consigne fixe) pour écrire comme ce coach.
 */

export const AI_METHOD_PROMPT_VERSION = 'method-v1';

const noteOut = z.string().max(300);
export const methodProposalSchema = z.object({
  status: z.enum(['ready', 'abstain']),
  notes: z.object(Object.fromEntries(METHOD_NOTE_KEYS.map((k) => [k, noteOut])) as Record<MethodNoteKey, typeof noteOut>).strict(),
  remarque: z.string().max(300),
}).strict();
export type MethodProposal = z.output<typeof methodProposalSchema>;

export const AI_METHOD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'notes', 'remarque'],
  properties: {
    status: { type: 'string', enum: ['ready', 'abstain'] },
    notes: { type: 'object', additionalProperties: false, required: [...METHOD_NOTE_KEYS], properties: Object.fromEntries(METHOD_NOTE_KEYS.map((k) => [k, { type: 'string' }])) },
    remarque: { type: 'string' },
  },
} as const;

export const AI_METHOD_SYSTEM_PROMPT = [
  'Rôle : assistant interne d’un coach d’endurance et de musculation. Tu décris sa façon d’écrire ses séances, pour que d’autres brouillons lui ressemblent. Le coach décide.',
  'Appelle lireSeancesBibliotheque (limite 20) pour lire ses séances. Décris seulement ce que tu y observes ; une case sans indice reste une chaîne vide.',
  `Six cases, une ou deux phrases courtes chacune (250 caractères au plus) : ${METHOD_NOTE_KEYS.map((k) => `${k} (${METHOD_NOTE_INFO[k].label.toLowerCase()})`).join(', ')}.`,
  'Écris à la première personne, comme le coach parlerait de lui (« Je … »). Pas de nom d’élève, pas d’avis médical.',
  'Si la bibliothèque a moins de trois séances, réponds status « abstain », cases vides, et dis dans remarque qu’il faut d’abord quelques séances.',
].join('\n');

export interface LibrarySessionFact { titre: string; sport: string; deroule: string }

const mostCommon = (xs: string[]): [string, number] | null => {
  const n = new Map<string, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null;
};
const SPORT_WORDS: Record<string, string> = { running: 'course à pied', trail: 'trail', cycling: 'vélo', swimming: 'natation', strength: 'musculation', triathlon: 'triathlon', duathlon: 'duathlon' };
const dur = (t: string) => t.replace(/'$/, ' min').replace(/'(\d+)/, ' min $1').replace(/"$/, ' s');

/** IA simulée : quelques constats simples tirés des séances (échauffement, repos, sports, séries). Déterministe. */
export function simulateMethodProposal(seances: LibrarySessionFact[]): MethodProposal {
  const empty = Object.fromEntries(METHOD_NOTE_KEYS.map((k) => [k, ''])) as Record<MethodNoteKey, string>;
  if (seances.length < 3) return { status: 'abstain', notes: empty, remarque: 'Ta bibliothèque a moins de trois séances : ajoute-en quelques-unes, puis redemande.' };
  const notes = { ...empty };
  // Échauffement : écrit « échauffement 10' … », ou première étape facile (« 10' RPE3 », « 15' Z1 ») comme la relit toNotation.
  const warm = mostCommon(seances.flatMap((s) => {
    const m = s.deroule.match(/^(?:échauffement\s+)?(\d+(?:'\d*)?)\s+(?:RPE[1-4]|Z[12])\b/i) ?? s.deroule.match(/échauffement (\d+(?:'\d*)?)/i);
    return m ? [m[1]!] : [];
  }));
  if (warm && warm[1] >= 2) notes.echauffement = `Je commence souvent par ${dur(warm[0])} d’échauffement (${warm[1]} séances sur ${seances.length}).`;
  const rests = mostCommon(seances.flatMap((s) => [...s.deroule.matchAll(/\b(?:R|repos )(\d+(?:'\d*|")?)/g)].map((m) => m[1]!)));
  if (rests && rests[1] >= 2) notes.repos = `Ma récupération la plus fréquente : ${dur(rests[0])}.`;
  const sport = mostCommon(seances.map((s) => s.sport));
  const sets = mostCommon(seances.flatMap((s) => [...s.deroule.matchAll(/(\d+)×\(?\d+ /g)].map((m) => m[1]!)));
  notes.principes = [sport ? `Mes séances sont surtout en ${SPORT_WORDS[sport[0]] ?? sport[0]}.` : '', sets && sets[1] >= 2 ? `En musculation, je fais le plus souvent ${sets[0]} séries.` : ''].filter(Boolean).join(' ');
  if (seances.some((s) => /récup/i.test(s.deroule))) notes.vocabulaire = 'J’écris « récup » pour la récupération.';
  return { status: 'ready', notes, remarque: `Proposition tirée de ${seances.length} séance${seances.length > 1 ? 's' : ''} de ta bibliothèque : relis et complète, surtout ta progression et ce que tu ne fais jamais.` };
}

/** Proposition → champs de la méthode (cases vides = rien). */
export const proposalToNotes = (p: MethodProposal): MethodNotes =>
  Object.fromEntries(METHOD_NOTE_KEYS.map((k) => [k, p.notes[k].trim() ? p.notes[k].trim().slice(0, 300) : null])) as MethodNotes;
