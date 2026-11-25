import { z } from 'zod';
import { addDays, localToUtc, weekStart, type LocalDate } from './dates';

/**
 * File des retours (§ 24 du PRD, D-082). « Le coach ouvre la source, lit le résultat et peut reporter ou clore.
 * Reporter exige une date future. » Un cas reporté revient seul dans la file à sa date.
 */

export const REVIEW_SNOOZE_MAX_DAYS = 30;

/** PATCH …/reviews/{rid} : reporter (date future) ou remettre dans la file. Clore passe par le retour (révision vue). */
export const updateReviewSchema = z
  .object({
    state: z.enum(['open', 'snoozed', 'done']),
    snoozeUntil: z.string().datetime({ offset: true, message: 'Date invalide' }).nullish().transform((v) => v ?? null),
  })
  .strict()
  .refine((v) => v.state !== 'snoozed' || v.snoozeUntil !== null, { message: 'Choisis jusqu’à quand reporter', path: ['snoozeUntil'] })
  .refine((v) => v.state !== 'done', { message: 'Ouvre le retour pour le marquer comme traité (la version lue est vérifiée)', path: ['state'] });
export type UpdateReviewInput = z.output<typeof updateReviewSchema>;

/** Contrôle de la date de report par rapport à maintenant : future, et au plus 30 jours. */
export function snoozeError(until: Date, now: Date): string | null {
  if (until.getTime() <= now.getTime() + 60_000) return 'La date de report doit être dans le futur';
  if (until.getTime() > now.getTime() + REVIEW_SNOOZE_MAX_DAYS * 86_400_000) return `${REVIEW_SNOOZE_MAX_DAYS} jours au plus`;
  return null;
}

/** Choix proposés au coach, à 7 h dans son fuseau : demain, dans 3 jours, lundi prochain. */
export function snoozeChoices(today: LocalDate, timeZone: string): { label: string; at: string }[] {
  const at = (d: LocalDate) => localToUtc(`${d}T07:00`, timeZone).toISOString();
  const monday = addDays(weekStart(today), 7);
  const out = [
    { label: 'Demain', at: at(addDays(today, 1)) },
    { label: 'Dans 3 jours', at: at(addDays(today, 3)) },
  ];
  if (monday !== addDays(today, 1) && monday !== addDays(today, 3)) out.push({ label: 'Lundi prochain', at: at(monday) });
  return out;
}

/** Filtre de la file, gardé dans l’adresse (C09-08) : élève, groupe, ou retours avec commentaire / effort élevé. */
export interface ReviewFilter { athleteId: string | null; teamId: string | null; only: 'comment' | 'hard' | 'readiness' | null }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseReviewFilter(sp: { eleve?: string; groupe?: string; seulement?: string }): ReviewFilter {
  return {
    athleteId: sp.eleve && UUID.test(sp.eleve) ? sp.eleve : null,
    teamId: sp.groupe && UUID.test(sp.groupe) ? sp.groupe : null,
    only: sp.seulement === 'commentaire' ? 'comment' : sp.seulement === 'effort' ? 'hard' : sp.seulement === 'pas-a-100' ? 'readiness' : null,
  };
}
/** Partie « ?… » de l’adresse pour retrouver le même filtre. */
export function reviewFilterQuery(f: ReviewFilter): string {
  const p = new URLSearchParams();
  if (f.athleteId) p.set('eleve', f.athleteId);
  if (f.teamId) p.set('groupe', f.teamId);
  if (f.only) p.set('seulement', f.only === 'comment' ? 'commentaire' : f.only === 'hard' ? 'effort' : 'pas-a-100');
  const s = p.toString();
  return s ? `?${s}` : '';
}
export function matchesReviewFilter(r: { athleteId: string; teamIds: string[]; hasComment: boolean; rpe: number | null; readiness?: string | null }, f: ReviewFilter): boolean {
  if (f.athleteId && r.athleteId !== f.athleteId) return false;
  if (f.teamId && !r.teamIds.includes(f.teamId)) return false;
  if (f.only === 'comment' && !r.hasComment) return false;
  if (f.only === 'hard' && !(r.rpe !== null && r.rpe >= 8)) return false;
  // D-088 : élèves qui ne sont pas à 100 %.
  if (f.only === 'readiness' && !(r.readiness === 'not_quite' || r.readiness === 'no')) return false;
  return true;
}

/**
 * Bilan produit (fluidité) · retour « sans signal » : séance réalisée, effort sous 8/10 (ou non dit), sans commentaire,
 * élève à 100 %. Le coach peut les traiter d’un geste ; tout le reste demande sa lecture.
 */
export function isRoutineReview(r: { resultState: string | null; hasComment: boolean; rpe: number | null; readiness?: string | null }): boolean {
  return r.resultState === 'completed' && !r.hasComment && (r.rpe === null || r.rpe < 8) && r.readiness !== 'not_quite' && r.readiness !== 'no';
}
