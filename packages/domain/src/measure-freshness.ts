import type { LocalDate } from './dates';

/**
 * Source, période et fraîcheur des mesures d’un élève (D-075, COUVERTURE § 3). Ce qui fonde les chiffres de sa fiche :
 * activités de la montre (D-048, D-064) ou saisie à la main, et depuis quand. Aucune donnée de santé.
 */

export interface MeasureFacts {
  windowDays: number;
  lastActivity: { date: LocalDate; format: 'fit' | 'tcx' | 'gpx' } | null;
  activities: number;
  feedbacks: number;
  /** Retours dont la durée ou la distance vient d’un fichier de montre. */
  fromWatch: number;
  lastFeedback: LocalDate | null;
}

const days = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const ago = (d: string, today: string) => { const n = days(d, today); return n <= 0 ? 'aujourd’hui' : n === 1 ? 'hier' : `il y a ${n} jours`; };

/** Phrases de la fiche, et un signal « à vérifier » quand plus rien n’arrive depuis 14 jours. */
export function measureFreshness(f: MeasureFacts, today: LocalDate): { lines: string[]; stale: boolean } {
  const lines: string[] = [];
  lines.push(f.lastActivity
    ? `Montre : dernière activité importée ${ago(f.lastActivity.date, today)} (${f.lastActivity.format.toUpperCase()}) · ${f.activities} activité${f.activities > 1 ? 's' : ''} sur ${f.windowDays} jours.`
    : 'Montre : aucune activité importée ; les mesures viennent de la saisie à la main.');
  lines.push(f.feedbacks
    ? `Retours : ${f.feedbacks} sur ${f.windowDays} jours, dont ${f.fromWatch} mesuré${f.fromWatch > 1 ? 's' : ''} par la montre et ${f.feedbacks - f.fromWatch} saisi${f.feedbacks - f.fromWatch > 1 ? 's' : ''} à la main.`
    : `Retours : aucun sur ${f.windowDays} jours.`);
  const last = [f.lastFeedback, f.lastActivity?.date].filter(Boolean).sort().at(-1) ?? null;
  const stale = !last || days(last, today) > 14;
  if (stale) lines.push(last ? `Rien de nouveau depuis ${days(last, today)} jours : les chiffres de la fiche datent.` : 'Aucune mesure pour l’instant : les chiffres de la fiche viendront avec ses retours.');
  return { lines, stale };
}
