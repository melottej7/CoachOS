import { addDays, type LocalDate } from './dates';
import { DIFFICULTY_LABELS, type Difficulty, type Readiness } from './feedback';

/**
 * Résumé de la semaine d’un élève, sans IA (module « summary » de docs/08, version déterministe, D-073).
 * « Décris prévu, déclaré et manquant, en trois faits au maximum. Termine par une seule question utile. »
 * Une absence de retour ne vaut ni séance manquée ni problème de santé. Moins de deux séances : données insuffisantes.
 */

export interface ReviewSession {
  date: LocalDate; title: string; canceled: boolean; plannedSeconds: number | null;
  state: 'completed' | 'partial' | 'missed' | 'postponed' | null;
  doneSeconds: number | null; rpe: number | null; feeling: number | null; difficulties: Difficulty[];
  /** D-088 : « à 100 % en ce moment ? » (facultatif). */
  readiness?: Readiness | null;
}

export interface WeekReview {
  monday: LocalDate;
  status: 'ok' | 'insufficient';
  counts: { planned: number; completed: number; partial: number; missed: number; postponed: number; noFeedback: number };
  plannedMin: number; doneMin: number; avgRpe: number | null;
  facts: string[];
  /** Une seule question utile à poser à l’élève (null si données insuffisantes). */
  question: string | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const hm = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`);
const dec = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');

export function weekReview(all: ReviewSession[], monday: LocalDate, today: LocalDate): WeekReview {
  const sunday = addDays(monday, 6);
  const end = sunday < today ? sunday : addDays(today, -1); // le jour même, le retour peut encore venir
  const s = all.filter((x) => !x.canceled && x.date >= monday && x.date <= end);
  const by = (st: ReviewSession['state']) => s.filter((x) => x.state === st);
  const counts = {
    planned: s.length, completed: by('completed').length, partial: by('partial').length, missed: by('missed').length,
    postponed: by('postponed').length, noFeedback: by(null).length,
  };
  const plannedMin = Math.round(s.reduce((n, x) => n + (x.plannedSeconds ?? 0), 0) / 60);
  const doneMin = Math.round(s.reduce((n, x) => n + (x.state === 'completed' || x.state === 'partial' ? x.doneSeconds ?? (x.state === 'completed' ? x.plannedSeconds ?? 0 : 0) : 0), 0) / 60);
  const rpes = s.flatMap((x) => (x.rpe !== null && (x.state === 'completed' || x.state === 'partial') ? [x.rpe] : []));
  const avgRpe = rpes.length >= 2 ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null;
  const base = { monday, counts, plannedMin, doneMin, avgRpe };
  // D-088 : la dernière réponse de la semaine ; « pas à 100 % » passe avant tout le reste, sans en chercher la cause.
  const lastReady = [...s].reverse().find((x) => x.readiness)?.readiness ?? null;
  const notFull = lastReady === 'not_quite' || lastReady === 'no';
  const readyFact = notFull ? `A répondu ne pas être ${lastReady === 'no' ? '' : 'tout à fait '}à 100 % en ce moment.` : null;
  const readyQuestion = 'Tu m’as dit ne pas être à 100 % en ce moment : on en parle pour adapter la suite ?';
  if (s.length < 2) {
    return { ...base, status: 'insufficient', facts: [`Données insuffisantes : ${s.length ? 'une seule séance' : 'aucune séance'} publiée sur la semaine.`, ...(readyFact ? [readyFact] : [])], question: notFull ? readyQuestion : null };
  }

  const done = counts.completed + counts.partial;
  const facts: string[] = [];
  facts.push(`${done} séance${done > 1 ? 's' : ''} faite${done > 1 ? 's' : ''} sur ${counts.planned}${counts.partial ? ` (dont ${counts.partial} en partie)` : ''} · ${hm(doneMin)} déclarées pour ${hm(plannedMin)} prévues.`);
  const gaps = [
    counts.missed ? plural(counts.missed, 'non faite', 'non faites') : null,
    counts.postponed ? plural(counts.postponed, 'reportée') : null,
    counts.noFeedback ? `${plural(counts.noFeedback, 'séance')} sans retour (on ne sait pas si elle${counts.noFeedback > 1 ? 's ont' : ' a'} été faite${counts.noFeedback > 1 ? 's' : ''})` : null,
  ].filter(Boolean);
  if (gaps.length) facts.push(`${gaps.join(', ')}.`);
  const hard = rpes.filter((r) => r >= 8).length;
  const low = s.filter((x) => x.feeling !== null && x.feeling <= 2).length;
  const diffs = new Map<Difficulty, number>();
  for (const x of s) for (const d of x.difficulties) diffs.set(d, (diffs.get(d) ?? 0) + 1);
  const topDiff = [...diffs].sort((a, b) => b[1] - a[1])[0];
  const feel = [
    avgRpe !== null ? `effort moyen déclaré ${dec(avgRpe)}/10${hard ? ` (${plural(hard, 'séance')} à 8 ou plus)` : ''}` : null,
    low ? `ressenti « fatigué » ou moins sur ${plural(low, 'séance')}` : null,
    topDiff ? `difficulté notée : ${DIFFICULTY_LABELS[topDiff[0]].toLowerCase()}${topDiff[1] > 1 ? ` (${topDiff[1]} fois)` : ''}` : null,
  ].filter(Boolean);
  if (feel.length) facts.push(`${feel.join(' ; ').replace(/^./, (c) => c.toUpperCase())}.`);

  // Une seule question, la plus utile : ce qui manque d’abord, puis ce qui a coûté, sinon la suite.
  const missed = by('missed')[0];
  const question = notFull ? readyQuestion : missed ? `Qu’est-ce qui t’a empêché de faire « ${missed.title} » ? On adapte la semaine prochaine si besoin.`
    : counts.noFeedback >= 2 ? 'Comment se sont passées tes séances de la semaine dont je n’ai pas eu de retour ?'
      : (avgRpe !== null && avgRpe >= 7.5) || hard >= 2 || low >= 2 ? 'Les séances t’ont semblé dures cette semaine : comment te sens-tu pour la suite ?'
        : topDiff ? `Tu as noté « ${DIFFICULTY_LABELS[topDiff[0]].toLowerCase()} » : on en parle pour ajuster ?`
          : done === counts.planned ? 'Belle régularité cette semaine ! Comment te sens-tu avant la suivante ?'
            : 'Comment s’est passée ta semaine ?';
  // « Pas à 100 % » remplace le dernier fait si la place manque.
  const kept = readyFact ? [...facts.slice(0, 2), readyFact] : facts.slice(0, 3);
  return { ...base, status: 'ok', facts: kept, question };
}
