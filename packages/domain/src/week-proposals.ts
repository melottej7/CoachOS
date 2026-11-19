import { z } from 'zod';
import { isLocalDate } from './dates';
import { stepLevel } from './session-profile';
import type { Sport } from './sports';
import { formatClock, structureTotals, type Block, type References, type Step } from './structure';

/**
 * Propositions d’adaptation d’une semaine (CE-P-05, D-056), reprises de l’éditeur de semaine de Foulée (capture 09) :
 * de la plus prudente à la plus exigeante, avec le volume avant → après, chaque séance barrée et remplacée,
 * et la conséquence probable. Foulée descend d’un « palier » dans sa bibliothèque ; CoachOS, sans paliers,
 * raisonne sur la structure des séances (intensité, volume, répétitions). Les séances faites, passées ou
 * annulées ne changent jamais. Rien n’est appliqué sans le choix du coach, et tout reste en brouillon.
 */

export const PROPOSAL_KINDS = ['recovery', 'lighter', 'endurance', 'restart'] as const;
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export const PROPOSAL_INFO: Record<ProposalKind, { title: string; summary: string; consequence: string }> = {
  recovery: {
    title: 'Semaine de récupération',
    summary: 'Les séances intenses deviennent faciles et plus courtes, les autres raccourcissent ; une séance en moins s’il y en a au moins quatre.',
    consequence: 'Le corps assimile le travail des semaines précédentes. La progression reprend ensuite, probablement avec plus de fraîcheur.',
  },
  lighter: {
    title: 'Alléger',
    summary: 'Environ un quart de volume en moins sur chaque séance (moins de répétitions, blocs plus courts), même intensité.',
    consequence: 'Charge plus basse cette semaine ; la suite du programme reste comme prévue.',
  },
  endurance: {
    title: 'Endurance seule',
    summary: 'Les séances de qualité deviennent des séances faciles. À choisir après une gêne, une fatigue ou un manque de sommeil.',
    consequence: 'Aucune intensité cette semaine : on garde l’habitude de s’entraîner sans charger.',
  },
  restart: {
    title: 'Semaine de reprise',
    summary: 'Endurance seule, et 40 minutes au plus par séance. Après une coupure ou une maladie.',
    consequence: 'Volume nettement plus bas : les semaines suivantes seront à ajuster à partir de ce qui aura été fait.',
  },
};

export interface WeekSession {
  id: string;
  revision: number;
  localDate: string;
  title: string;
  sport: Sport;
  blocks: Block[];
  durationSeconds: number | null;
  /** Faite, passée ou annulée : ne change pas. */
  locked: boolean;
}

export interface ProposedSession { title: string; seconds: number; blocks: Block[]; durationSeconds: number | null }
export interface ProposedChange {
  id: string;
  revision: number;
  localDate: string;
  before: { title: string; seconds: number };
  /** null : séance retirée (annulée) cette semaine. */
  after: ProposedSession | null;
}
export interface WeekProposal {
  kind: ProposalKind;
  beforeSeconds: number;
  afterSeconds: number;
  changes: ProposedChange[];
  /** Séances qui ne changent pas (faites, passées, annulées). */
  locked: number;
}

/** Durée d’une séance : déroulé estimé, sinon durée saisie. */
export function sessionSeconds(s: { blocks: Block[]; durationSeconds: number | null; sport: Sport }, refs?: References): number {
  const t = structureTotals(s.blocks, { sport: s.sport, refs });
  return t.seconds || s.durationSeconds || 0;
}

function steps(blocks: Block[]): Step[] {
  return blocks.flatMap((b) => (b.type === 'step' ? [b] : steps(b.steps)));
}

/** Niveau le plus haut de la séance (1 à 7) ; 0 sans déroulé. */
export function sessionLevel(s: { blocks: Block[]; sport: Sport }, refs?: References): number {
  return steps(s.blocks).reduce((m, st) => Math.max(m, stepLevel(st, s.sport, refs).level), 0);
}

/** Séance de qualité : seuil ou plus (niveau 4+), ou effort ressenti élevé. */
export const isQuality = (s: { blocks: Block[]; sport: Sport }, refs?: References) => sessionLevel(s, refs) >= 4;

const round5 = (min: number) => Math.max(5, Math.round(min / 5) * 5);
/** « 35′ » sous l’heure, « 1 h 10 » au-delà. */
const minLabel = (min: number) => (min < 60 ? `${min}′` : formatClock(min * 60));

/** Séance facile continue : une étape en Z2 (« Footing 35′ », « Sortie vélo facile 1 h 10 »…). */
export function easySession(sport: Sport, minutes: number, long = false): ProposedSession {
  const m = round5(minutes);
  const name = long ? 'Sortie longue' : sport === 'cycling' ? 'Sortie vélo facile' : sport === 'swimming' ? 'Nage facile' : sport === 'running' || sport === 'trail' ? 'Footing' : 'Endurance';
  const step: Step = { type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: m * 60 }, intensity: { kind: 'zone', zone: 2 }, cadence: null, note: null };
  return { title: `${name} ${minLabel(m)}`, seconds: m * 60, blocks: [step], durationSeconds: null };
}

/** Réduit le volume d’un facteur : moins de répétitions (au moins 2), blocs continus plus courts, intensité inchangée. */
export function scaleBlocks(blocks: Block[], factor: number): Block[] {
  return blocks.map((b): Block => {
    if (b.type === 'repeat') {
      // Moins de répétitions ; si l’on est déjà à 2, on raccourcit plutôt chaque répétition.
      const t = Math.round(b.times * factor);
      return t >= 2 && t < b.times ? { ...b, times: t } : { ...b, steps: scaleBlocks(b.steps, factor) as typeof b.steps };
    }
    const m = b.measure;
    if (m.kind === 'time') return { ...b, measure: { kind: 'time', seconds: Math.max(60, Math.round((m.seconds * factor) / 60) * 60) } };
    if (m.kind === 'distance') return { ...b, measure: { kind: 'distance', meters: Math.max(100, Math.round((m.meters * factor) / 100) * 100) } };
    return b;
  });
}

function shorter(s: WeekSession, factor: number, refs?: References): ProposedSession {
  if (!s.blocks.length) {
    const sec = s.durationSeconds ? round5((s.durationSeconds * factor) / 60) * 60 : null;
    return { title: s.title, seconds: sec ?? 0, blocks: [], durationSeconds: sec };
  }
  const blocks = scaleBlocks(s.blocks, factor);
  return { title: s.title, seconds: sessionSeconds({ blocks, durationSeconds: null, sport: s.sport }, refs), blocks, durationSeconds: null };
}

const looksLong = (s: WeekSession) => /longue/i.test(s.title);

/** Une proposition pour la semaine ; les séances bloquées comptent dans le volume mais ne changent pas. */
export function proposeWeek(sessions: WeekSession[], kind: ProposalKind, refs?: References): WeekProposal {
  const open = sessions.filter((s) => !s.locked);
  const secOf = new Map(sessions.map((s) => [s.id, sessionSeconds(s, refs)]));
  const lockedSeconds = sessions.filter((s) => s.locked).reduce((n, s) => n + (secOf.get(s.id) ?? 0), 0);
  // Semaine de récupération : la séance la plus exigeante saute s’il en reste au moins quatre.
  const dropped = kind === 'recovery' && open.length >= 4
    ? [...open].sort((a, b) => sessionLevel(b, refs) - sessionLevel(a, refs) || (secOf.get(b.id) ?? 0) - (secOf.get(a.id) ?? 0))[0]!.id
    : null;
  const changes: ProposedChange[] = open.map((s) => {
    const sec = secOf.get(s.id) ?? 0;
    const min = sec / 60 || 45;
    const quality = isQuality(s, refs);
    let after: ProposedSession | null;
    if (s.id === dropped) after = null;
    else if (kind === 'lighter') after = shorter(s, 0.75, refs);
    else if (kind === 'recovery') after = quality ? easySession(s.sport, min * 0.7) : shorter(s, 0.75, refs);
    else if (kind === 'endurance') after = quality ? easySession(s.sport, min * 0.8) : looksLong(s) ? easySession(s.sport, min * 0.9, true) : shorter(s, 0.9, refs);
    else after = easySession(s.sport, Math.min(40, min * 0.8));
    return { id: s.id, revision: s.revision, localDate: s.localDate, before: { title: s.title, seconds: sec }, after };
  });
  return {
    kind,
    beforeSeconds: lockedSeconds + open.reduce((n, s) => n + (secOf.get(s.id) ?? 0), 0),
    afterSeconds: lockedSeconds + changes.reduce((n, c) => n + (c.after?.seconds ?? 0), 0),
    changes,
    locked: sessions.length - open.length,
  };
}

/** Appliquer une proposition : la semaine (lundi), le choix, et les révisions vues dans l’aperçu (409 si l’une a changé). */
export const applyProposalSchema = z
  .object({
    monday: z.string().refine(isLocalDate, { message: 'Date invalide' }),
    kind: z.enum(PROPOSAL_KINDS),
    seen: z.array(z.object({ id: z.string().uuid(), revision: z.number().int().min(1) }).strict()).max(40),
  })
  .strict();
