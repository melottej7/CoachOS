import { z } from 'zod';
import {
  athleteProfileSchema, BREAK_LENGTHS, EQUIPMENT, STRENGTH_FOCUS, EXPERIENCES, LEVELS, LONGEST_RECENT, PRACTICE_STATUSES, PREFERRED_TIMES, RESUMED_SINCE, WEEKDAY_MINUTES,
  WEEKLY_HOURS, WEEKLY_SESSIONS,
  type AthleteProfileInput, type PracticeStatus,
} from './athlete-profile';
import { isLocalDate } from './dates';
import type { Sport } from './sports';
import { SPORTS } from './workout';

/**
 * Bilan d’arrivée (CE-B-04, CE-B-05, D-054). Ergonomie reprise de Foulée (capture 01) : une question par écran,
 * questions qui s’adaptent aux réponses, toucher une réponse fait avancer, récapitulatif avant l’envoi.
 * CoachOS ajoute : tous les sports, brouillon sur le serveur (reprise sur un autre appareil), complétude,
 * confirmation par le coach, et le même bilan rempli par le coach pendant l’entretien, avec la source de chaque réponse.
 */

export type BilanStep =
  | 'sport' | 'mainSport' | 'status' | 'experience' | 'break' | 'resumed' | 'sessions' | 'longest' | 'level' | 'focus' | 'hours' | 'days' | 'time' | 'equipment' | 'goal' | 'recap';
const STEP_NAMES = ['sport', 'mainSport', 'status', 'experience', 'break', 'resumed', 'sessions', 'longest', 'level', 'focus', 'hours', 'days', 'time', 'equipment', 'goal', 'recap'] as const;

/** D-108 : sports choisis dans le bilan, le principal d’abord. */
export function bilanSports(a: BilanAnswers): Sport[] {
  return [...new Set([...(a.sport ? [a.sport] : []), ...(a.otherSports ?? [])])];
}
/** D-108 : le bilan pose les questions de musculation si elle fait partie des sports choisis. */
export const wantsStrength = (a: BilanAnswers) => bilanSports(a).includes('strength');

/** Réponses en cours : tout est facultatif tant que le bilan n’est pas envoyé. */
export type BilanAnswers = Partial<AthleteProfileInput>;

/** « la course à pied », « le vélo »… pour formuler les questions. */
export const SPORT_WITH_ARTICLE: Record<Sport, string> = {
  running: 'la course à pied', trail: 'le trail', cycling: 'le vélo', swimming: 'la natation', triathlon: 'le triathlon', duathlon: 'le duathlon', strength: 'la musculation',
};

/** Écrans visibles selon les réponses déjà données (ordre du parcours). */
export function bilanSteps(a: BilanAnswers): BilanStep[] {
  const s: BilanStep[] = ['sport'];
  // D-108 : plusieurs sports → on demande lequel compte le plus (les questions suivantes portent sur lui).
  if (bilanSports(a).length > 1) s.push('mainSport');
  s.push('status');
  const st = a.practiceStatus;
  if (st !== 'beginner') s.push('experience');
  if (st === 'resumed' || st === 'stopped') s.push('break');
  if (st === 'resumed') s.push('resumed');
  if (st !== 'stopped') s.push('sessions');
  // La « plus longue sortie » n’a pas de sens en musculation.
  if (st !== 'stopped' && a.sport !== 'strength') s.push('longest');
  if (st !== 'beginner') s.push('level');
  if (wantsStrength(a)) s.push('focus');
  s.push('hours', 'days', 'time', 'equipment', 'goal', 'recap');
  return s;
}

/** Réponses déduites : un débutant n’a ni ancienneté ni niveau à choisir ; un arrêt actuel = 0 ou 1 séance par semaine. */
export function deriveBilan(a: BilanAnswers): BilanAnswers {
  const out: BilanAnswers = { ...a };
  const st: PracticeStatus | null | undefined = a.practiceStatus;
  if (st === 'beginner') { out.experience = 'lt1'; out.level = 'beginner'; out.breakLength = null; out.resumedSince = null; }
  if (st === 'stopped') { out.weeklySessions = '0to1'; out.longestRecent = null; out.resumedSince = null; }
  if (st === 'regular') { out.breakLength = null; out.resumedSince = null; }
  // D-108 : le principal n’est jamais répété dans les autres sports ; pas de séance longue ni de « sortie » en musculation.
  if (out.sport && out.otherSports?.includes(out.sport)) out.otherSports = out.otherSports.filter((x) => x !== out.sport);
  if (out.sport === 'strength') { out.longestRecent = null; out.longDay = null; }
  if (!wantsStrength(out)) out.strengthFocus = [];
  return out;
}

/** Écrans obligatoires (les autres peuvent être passés). */
const REQUIRED: Partial<Record<BilanStep, (a: BilanAnswers) => boolean>> = {
  sport: (a) => Boolean(a.sport),
  status: (a) => Boolean(a.practiceStatus),
  experience: (a) => Boolean(a.experience),
  break: (a) => Boolean(a.breakLength),
  resumed: (a) => Boolean(a.resumedSince),
  sessions: (a) => Boolean(a.weeklySessions),
  level: (a) => Boolean(a.level),
};

/** Complétude : écrans obligatoires répondus sur écrans obligatoires visibles. */
export function bilanCompletion(a: BilanAnswers): { answered: number; total: number; complete: boolean } {
  const steps = bilanSteps(a).filter((s) => REQUIRED[s]);
  const answered = steps.filter((s) => REQUIRED[s]!(a)).length;
  return { answered, total: steps.length, complete: answered === steps.length };
}

/** Premier écran obligatoire sans réponse (reprise), sinon le récapitulatif. */
export function resumeStep(a: BilanAnswers): BilanStep {
  return bilanSteps(a).find((s) => REQUIRED[s] && !REQUIRED[s]!(a)) ?? 'recap';
}

/** Brouillon du bilan (PUT …/athlete-profile/draft) : mêmes valeurs permises, toutes facultatives. */
export const bilanDraftSchema = z
  .object({
    step: z.enum(STEP_NAMES),
    answers: z
      .object({
        sport: z.enum(SPORTS).nullish(),
        otherSports: z.array(z.enum(SPORTS)).max(SPORTS.length).nullish(),
        strengthFocus: z.array(z.enum(STRENGTH_FOCUS)).max(STRENGTH_FOCUS.length).nullish(),
        practiceStatus: z.enum(PRACTICE_STATUSES).nullish(),
        experience: z.enum(EXPERIENCES).nullish(),
        breakLength: z.enum(BREAK_LENGTHS).nullish(),
        resumedSince: z.enum(RESUMED_SINCE).nullish(),
        weeklySessions: z.enum(WEEKLY_SESSIONS).nullish(),
        longestRecent: z.enum(LONGEST_RECENT).nullish(),
        level: z.enum(LEVELS).nullish(),
        weeklyHours: z.enum(WEEKLY_HOURS).nullish(),
        availableDays: z.array(z.number().int().min(1).max(7)).max(7).nullish(),
        mainGoal: z.string().max(300).nullish(),
        nextEventName: z.string().max(120).nullish(),
        nextEventDate: z.string().refine(isLocalDate, { message: 'Date invalide' }).nullish(),
        weekdayMinutes: z.enum(WEEKDAY_MINUTES).nullish(),
        preferredTime: z.enum(PREFERRED_TIMES).nullish(),
        longDay: z.number().int().min(1).max(7).nullish(),
        equipment: z.array(z.enum(EQUIPMENT)).max(EQUIPMENT.length).nullish(),
        practicalConstraints: z.string().max(300).nullish(),
      })
      .strict(),
  })
  .strict();
export type BilanDraftInput = z.output<typeof bilanDraftSchema>;

/** Bilan rempli par le coach pendant ou après l’entretien (CE-B-05) : révision attendue (null s’il n’existe pas encore). */
export const coachBilanSchema = z
  .object({ expectedRevision: z.number().int().min(1).nullable(), data: athleteProfileSchema })
  .strict();
/** Confirmation du bilan par le coach (CE-B-04). */
export const confirmBilanSchema = z.object({ expectedRevision: z.number().int().min(1) }).strict();

export type BilanSource = 'athlete' | 'interview';
export const BILAN_SOURCE_LABELS: Record<BilanSource, string> = { athlete: 'Déclaré', interview: 'Entretien' };
export type BilanStatus = 'none' | 'draft' | 'submitted' | 'confirmed';
export const BILAN_STATUS_LABELS: Record<BilanStatus, string> = {
  none: 'Pas commencé', draft: 'En cours', submitted: 'Envoyé, à confirmer', confirmed: 'Confirmé',
};

/** Champs du profil suivis pour la provenance des réponses. */
export const BILAN_FIELDS = [
  'sport', 'otherSports', 'strengthFocus', 'practiceStatus', 'experience', 'breakLength', 'resumedSince', 'weeklySessions', 'longestRecent', 'level', 'weeklyHours',
  'availableDays', 'mainGoal', 'nextEventName', 'nextEventDate', 'weekdayMinutes', 'preferredTime', 'longDay', 'equipment', 'practicalConstraints',
] as const;
export type BilanField = (typeof BILAN_FIELDS)[number];
export const BILAN_FIELD_LABELS: Record<BilanField, string> = {
  sport: 'Sport principal', otherSports: 'Autres sports', strengthFocus: 'Musculation : à travailler', practiceStatus: 'Situation', experience: 'Pratique régulière', breakLength: 'Durée de l’arrêt', resumedSince: 'Reprise',
  weeklySessions: 'Séances par semaine', longestRecent: 'Plus longue sortie', level: 'Niveau', weeklyHours: 'Heures par semaine',
  availableDays: 'Jours disponibles', mainGoal: 'Objectif', nextEventName: 'Prochaine course', nextEventDate: 'Date de la course',
  weekdayMinutes: 'Temps en semaine', preferredTime: 'Moment préféré', longDay: 'Jour de la séance longue', equipment: 'Matériel', practicalConstraints: 'Contraintes',
};

/** Provenance après une saisie : les champs modifiés prennent la nouvelle source, les autres gardent la leur. */
export function nextSources(
  prev: BilanAnswers | null, next: AthleteProfileInput, prevSources: Partial<Record<BilanField, BilanSource>>, source: BilanSource,
): Partial<Record<BilanField, BilanSource>> {
  const out: Partial<Record<BilanField, BilanSource>> = {};
  for (const f of BILAN_FIELDS) {
    const before = prev ? JSON.stringify(prev[f] ?? null) : undefined;
    const after = JSON.stringify(next[f] ?? null);
    if (next[f] === null || (Array.isArray(next[f]) && !(next[f] as unknown[]).length)) continue;
    // Inchangé : garde sa provenance ; un profil antérieur aux provenances (D-054) avait été rempli par l’élève.
    out[f] = before === after ? (prevSources[f] ?? 'athlete') : source;
  }
  return out;
}
