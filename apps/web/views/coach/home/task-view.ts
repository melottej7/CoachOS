import { addDays, formatEstimate, formatShortDate, formatWeekday, PRIORITY_LABELS, TASK_KIND_LABELS, TASK_RECURRENCE_LABELS, type Priority, type TaskKind } from '@coachos/domain';
import type { HomeTask } from '@/server/repo/portfolio';
import type { TaskView } from './task-item';

function dueText(t: HomeTask, today: string): string {
  if (!t.dueOn) return 'Sans échéance';
  if (t.dueOn === today) return 'Aujourd’hui';
  if (t.dueOn < today) {
    const days = Math.round((Date.parse(today) - Date.parse(t.dueOn)) / 86_400_000);
    return `En retard de ${days} jour${days > 1 ? 's' : ''}`;
  }
  if (t.dueOn === addDays(today, 1)) return 'Demain';
  return `${formatWeekday(t.dueOn)} ${formatShortDate(t.dueOn)}`;
}

/** Une tâche prête à afficher (Accueil, fiche élève) : échéance, créneau, durée et type en toutes lettres. */
export function taskView(t: HomeTask, today: string, opts: { athleteHref: string | null; link?: string | null }): TaskView {
  const slot = t.slotOn
    ? `Créneau ${t.slotOn === today ? 'aujourd’hui' : t.slotOn === addDays(today, 1) ? 'demain' : `${formatWeekday(t.slotOn).toLowerCase()} ${formatShortDate(t.slotOn)}`}${t.slotTime ? ` à ${t.slotTime}` : ''}`
    : null;
  return {
    key: t.key, source: t.source, id: t.id, rule: t.rule, ref: t.ref, revision: t.revision, link: opts.link === undefined ? t.link : opts.link, athlete: t.athlete,
    athleteHref: opts.athleteHref, team: t.team?.name ?? null,
    title: t.title, reason: t.reason, priority: t.priority, priorityLabel: `Priorité ${PRIORITY_LABELS[t.priority as Priority].toLowerCase()}`,
    recurrence: t.recurrence ? TASK_RECURRENCE_LABELS[t.recurrence] : null, notes: t.notes,
    meta: [
      t.slotOn ? `Échéance : ${dueText(t, today).toLowerCase()}` : dueText(t, today),
      slot, t.estimateMin ? `≈ ${formatEstimate(t.estimateMin)}` : null, TASK_KIND_LABELS[t.kind as TaskKind],
    ].filter((x): x is string => Boolean(x)),
    slot: { slotOn: t.slotOn ?? null, slotTime: t.slotTime ?? null, estimateMin: t.estimateMin ?? null },
  };
}
