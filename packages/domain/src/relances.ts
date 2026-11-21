import { addDays, type LocalDate } from './dates';
import type { Readiness } from './feedback';

/**
 * D-103 · Relances pré-rédigées. Chaque élève reçoit un statut lisible, calculé par des règles simples et
 * expliquées (jamais un score opaque) ; une relance adaptée à la situation est proposée. Le coach la relit,
 * la modifie et l’envoie lui-même : rien ne part tout seul (CLAUDE.md).
 */

export const ADHERENCE = ['silent', 'at_risk', 'watch', 'on_track', 'no_plan'] as const;
export type AdherenceStatus = (typeof ADHERENCE)[number];
export const ADHERENCE_LABELS: Record<AdherenceStatus, string> = {
  silent: 'Silencieux', at_risk: 'À risque', watch: 'À surveiller', on_track: 'En rythme', no_plan: 'Sans séance',
};

export type RelanceKind = 'silent' | 'readiness' | 'missed' | 'no_feedback' | 'bravo';
export const RELANCE_LABELS: Record<RelanceKind, string> = {
  silent: 'Reprendre contact', readiness: 'Pas à 100 %', missed: 'Séances manquées', no_feedback: 'Retour attendu', bravo: 'Encourager',
};

export interface RecentSession { id: string; date: LocalDate; title: string; state: 'completed' | 'partial' | 'missed' | 'postponed' | null }
export interface AdherenceInput {
  today: LocalDate;
  /** Séances publiées des 14 derniers jours (aujourd’hui exclu), non annulées, avec l’état déclaré s’il existe. */
  recent: RecentSession[];
  lastFeedbackOn: LocalDate | null;
  lastAthleteMessageOn: LocalDate | null;
  lastCoachMessageOn: LocalDate | null;
  readiness: { value: Readiness; on: LocalDate } | null;
  upcoming7: number;
}
export interface Adherence {
  status: AdherenceStatus;
  /** Pourquoi, en clair (« Aucune nouvelle depuis 9 jours »). */
  reason: string;
  relance: RelanceKind | null;
  /** Le coach a déjà écrit depuis le signal : on attend la réponse (relance non comptée dans « à faire »). */
  waitingSince: LocalDate | null;
  /** Séance concernée (retour attendu, séance manquée). */
  workout: RecentSession | null;
  silentDays: number | null;
  done7: number;
  due7: number;
}

const days = (from: LocalDate, to: LocalDate) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
const maxDate = (...d: (LocalDate | null)[]) => d.filter((x): x is LocalDate => Boolean(x)).sort().at(-1) ?? null;

/** Seuils des règles : 7 jours sans nouvelle = silencieux ; un retour est attendu 2 jours après la séance. */
export const SILENT_DAYS = 7;
export const FEEDBACK_GRACE_DAYS = 2;
/** Une relance envoyée reste « en attente de réponse » pendant 3 jours. */
export const WAIT_DAYS = 3;

export function adherenceOf(x: AdherenceInput): Adherence {
  const weekAgo = addDays(x.today, -7);
  const last7 = x.recent.filter((s) => s.date >= weekAgo);
  const due7 = last7.length;
  const done7 = last7.filter((s) => s.state === 'completed' || s.state === 'partial').length;
  // Sans nouvelle = séance passée depuis au moins 2 jours, sans retour, ou déclarée non faite.
  const missing = last7.filter((s) => (s.state === null && days(s.date, x.today) >= FEEDBACK_GRACE_DAYS) || s.state === 'missed').sort((a, b) => b.date.localeCompare(a.date));
  const lastContact = maxDate(x.lastFeedbackOn, x.lastAthleteMessageOn);
  const firstDue = x.recent.map((s) => s.date).sort()[0] ?? null;
  const silentFrom = lastContact ?? firstDue;
  const silentDays = silentFrom ? days(silentFrom, x.today) : null;
  const waiting = (since: LocalDate | null) => (x.lastCoachMessageOn && since && x.lastCoachMessageOn >= since && days(x.lastCoachMessageOn, x.today) <= WAIT_DAYS ? x.lastCoachMessageOn : null);
  const base = { silentDays, done7, due7 };

  if (x.recent.length >= 2 && silentDays !== null && silentDays >= SILENT_DAYS) {
    return { ...base, status: 'silent', relance: 'silent', workout: missing[0] ?? null, waitingSince: waiting(silentFrom),
      reason: `Aucune nouvelle depuis ${silentDays} jours${missing.length ? ` (${missing.length} séance${missing.length > 1 ? 's' : ''} sans retour ces 7 derniers jours)` : ''}` };
  }
  if (x.readiness && x.readiness.value !== 'full' && days(x.readiness.on, x.today) <= 14) {
    return { ...base, status: 'at_risk', relance: 'readiness', workout: null, waitingSince: waiting(x.readiness.on),
      reason: `${x.readiness.value === 'no' ? 'Ne peut pas faire ses séances à 100 %' : 'Pas tout à fait à 100 %'} depuis le ${x.readiness.on.slice(8, 10)}/${x.readiness.on.slice(5, 7)}` };
  }
  if (missing.length >= 2) {
    return { ...base, status: 'at_risk', relance: 'missed', workout: missing[0]!, waitingSince: waiting(missing[0]!.date),
      reason: `${missing.length} séances sur ${due7} sans retour ou non faites ces 7 derniers jours` };
  }
  if (missing.length === 1) {
    const m = missing[0]!;
    return { ...base, status: 'watch', relance: m.state === 'missed' ? 'missed' : 'no_feedback', workout: m, waitingSince: waiting(m.date),
      reason: m.state === 'missed' ? `« ${m.title} » non faite` : `Pas de retour sur « ${m.title} »` };
  }
  if (!x.recent.length && !x.upcoming7) {
    return { ...base, status: 'no_plan', relance: null, workout: null, waitingSince: null, reason: 'Aucune séance ces deux semaines ni dans les 7 prochains jours' };
  }
  return { ...base, status: 'on_track', relance: done7 >= 2 && done7 === due7 ? 'bravo' : null, workout: null, waitingSince: done7 >= 2 ? waiting(weekAgo) : null,
    reason: due7 ? `${done7} séance${done7 > 1 ? 's' : ''} faite${done7 > 1 ? 's' : ''} sur ${due7} ces 7 derniers jours` : 'Pas de séance ces 7 derniers jours' };
}

const WEEKDAY = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const dayName = (d: LocalDate) => WEEKDAY[new Date(`${d}T12:00:00Z`).getUTCDay()]!;

/**
 * Brouillon de relance, dans un ton simple et chaleureux (tutoiement). Il sert de point de départ : le coach
 * l’adapte. Aucune question de santé : pour « pas à 100 % », on propose d’en parler (D-084, D-088).
 */
export function relanceDraft(kind: RelanceKind, c: { first: string; workout?: RecentSession | null; silentDays?: number | null; done7?: number; due7?: number }): string {
  const w = c.workout;
  switch (kind) {
    case 'silent':
      return `Salut ${c.first} ! Je n’ai pas eu de nouvelles depuis ${c.silentDays ?? 'quelques'} jours 🙂 Comment ça va ? Si les dernières semaines ont été chargées, aucun souci : dis-moi simplement où tu en es, et on adapte la suite ensemble.`;
    case 'readiness':
      return `Salut ${c.first}, tu m’as dit ne pas être à 100 % en ce moment. On en parle ? Dis-moi quand tu as cinq minutes pour un appel : on adapte les prochaines séances, sans forcer.`;
    case 'missed':
      return `Hello ${c.first} ! Je vois que${w ? ` « ${w.title} » (${dayName(w.date)})` : ' les dernières séances'} n’${w ? 'a' : 'ont'} pas pu se faire. Rien de grave ! Qu’est-ce qui a coincé : le temps, la fatigue, autre chose ? Je t’ajuste la semaine pour que ça colle mieux.`;
    case 'no_feedback':
      return `Coucou ${c.first} ! Comment s’est passée ta séance${w ? ` « ${w.title} » de ${dayName(w.date)}` : ''} ? Un retour rapide dans l’app (15 secondes) m’aide à préparer la suite 💪`;
    case 'bravo':
      return `Bravo ${c.first} ! ${c.done7 ?? ''} séance${(c.done7 ?? 0) > 1 ? 's' : ''} sur ${c.due7 ?? ''} cette semaine, c’est top. Continue comme ça 👏`.replace(/ {2,}/g, ' ');
  }
}

/** Ordre d’affichage : silencieux, à risque, à surveiller, puis les encouragements. */
export const ADHERENCE_RANK: Record<AdherenceStatus, number> = { silent: 0, at_risk: 1, watch: 2, on_track: 3, no_plan: 4 };
