import Link from 'next/link';
import { dayOfMonth, formatDuration, formatShortDate, formatWeekday, RESULT_STATE_LABELS, SPORT_LABELS, WORKOUT_STATUS_LABELS } from '@coachos/domain';
import type { CoachWorkoutCard } from '@/server/repo/coach';
import { Badge, Icon, type Tone } from '@/design';
import { cx } from '@/design/cx';
import s from './calendar.module.css';

const STATUS_TONE: Record<CoachWorkoutCard['status'], Tone> = { draft: 'neutral', published: 'success', changed: 'warning' };

/**
 * Semaine d’un élève (X18, refonte Chrono D-146) : sept colonnes sur ordinateur, les jours l’un sous l’autre sur téléphone.
 * Chaque séance dit son statut en toutes lettres (brouillon invisible pour l’élève, publiée, modifiée à republier, annulée)
 * et l’état de son retour ; « Ajouter » sous chaque jour.
 */
export function WeekGrid({ days, workouts, today, href, newHref, tourDay }: {
  days: string[]; workouts: CoachWorkoutCard[]; today: string; href: (id: string) => string; newHref: (d: string) => string; tourDay: string;
}) {
  return (
    <ol className={s.week}>
      {days.map((d) => {
        const items = workouts.filter((w) => w.localDate === d);
        return (
          <li key={d} className={cx(s.day, d === today && s.today, d < today && s.past)} aria-current={d === today ? 'date' : undefined}>
            <h3 className={s.dayHead}><span>{formatWeekday(d)}</span> <strong>{dayOfMonth(d)}</strong>{d === today ? <span className="ds-visually-hidden"> (aujourd’hui)</span> : null}</h3>
            {items.length ? (
              <ul className={s.cards}>
                {items.map((w) => (
                  <li key={w.id}>
                    <Link className={cx(s.card, s[w.status], w.canceled && s.canceled)} href={href(w.id)}>
                      <span className={s.cardTitle}>{w.title}</span>
                      <span className={s.cardMeta}>{[SPORT_LABELS[w.sport], formatDuration(w.durationSeconds)].filter(Boolean).join(' · ')}</span>
                      <span className={s.badges}>
                        {w.canceled
                          ? <Badge tone="danger">{w.status === 'published' ? 'Annulée' : 'Annulée · à republier'}</Badge>
                          : <Badge tone={STATUS_TONE[w.status]}>{WORKOUT_STATUS_LABELS[w.status]}</Badge>}
                        {w.feedback ? <Badge tone={w.feedback.reviewed ? 'neutral' : 'signal'} dot={!w.feedback.reviewed}>{RESULT_STATE_LABELS[w.feedback.state]}{w.feedback.reviewed ? ' · traité' : ' · à traiter'}</Badge> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className={s.rest}>Rien de prévu</p>}
            <Link className={s.add} href={newHref(d)} aria-label={`Ajouter une séance le ${formatWeekday(d).toLowerCase()} ${formatShortDate(d)}`} data-tour={d === tourDay ? 'day-add' : undefined}>
              <Icon name="plus" size={16} />Ajouter
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
