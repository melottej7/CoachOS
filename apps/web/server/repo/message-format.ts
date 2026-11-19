import { addDays, formatLongDate, todayIn, utcToLocal } from '@coachos/domain';
import { RESULT_STATE_LABELS, formatShortDate, type ResultState } from '@coachos/domain';
import type { FeedbackEvent, ThreadMessage } from './messages';

/** Libellés de jour et d’heure dans le fuseau du lecteur, calculés côté serveur. */
export interface UiOptions {
  /** Lien vers une séance selon le lecteur (page coach ou page élève). */
  workoutHref?: (workoutId: string) => string;
  /** Retours de séance à intercaler dans la conversation. */
  feedbacks?: FeedbackEvent[];
}

export function toUi(messages: ThreadMessage[], tz: string, opts: UiOptions = {}) {
  const today = todayIn(tz);
  const dayOf = (iso: string) => {
    const l = utcToLocal(new Date(iso), tz);
    return { day: l.date === today ? 'Aujourd’hui' : l.date === addDays(today, -1) ? 'Hier' : formatLongDate(l.date), time: l.time };
  };
  const workoutLabel = (w: { title: string; localDate: string }) => `${w.title} · ${formatShortDate(w.localDate).replace(/\.$/, '')}`;
  const events = (opts.feedbacks ?? []).map((f) => {
    const d = dayOf(f.createdAt);
    return {
      id: `fb-${f.id}`, body: '', mine: false, senderName: '', fromCoach: false, voiceId: null, voiceDurationS: null, ...d, at: Date.parse(f.createdAt), appointment: null, workout: null,
      event: {
        title: workoutLabel(f.workout), href: opts.workoutHref ? opts.workoutHref(f.workout.id) : null,
        state: RESULT_STATE_LABELS[f.state as ResultState] ?? f.state, rpe: f.rpe, comment: f.comment, reviewed: f.reviewed,
      },
    };
  });
  const items = messages.map((m) => {
    const l = utcToLocal(new Date(m.createdAt), tz);
    const day = l.date === today ? 'Aujourd’hui' : l.date === addDays(today, -1) ? 'Hier' : formatLongDate(l.date);
    const a = m.appointment ?? null;
    let appointment = null;
    if (a) {
      // Heure affichée dans le fuseau du lecteur, avec le fuseau du rendez-vous s’il diffère.
      const start = new Date(a.startsAt);
      const ls = utcToLocal(start, tz);
      const le = utcToLocal(new Date(start.getTime() + a.durationMin * 60_000), tz);
      appointment = {
        id: a.id, title: a.title, kind: a.kind, status: a.status, videoUrl: a.videoUrl, durationMin: a.durationMin,
        dateLabel: formatLongDate(ls.date), time: ls.time, endTime: le.time, startsAt: a.startsAt,
        past: start.getTime() + a.durationMin * 60_000 < Date.now(),
      };
    }
    return {
      id: m.id, body: m.body, mine: m.mine, senderName: m.senderName, fromCoach: m.fromCoach, voiceId: m.voiceId, voiceDurationS: m.voiceDurationS,
      day, time: l.time, at: Date.parse(m.createdAt), appointment, event: null,
      workout: m.workout ? { label: workoutLabel(m.workout), href: opts.workoutHref ? opts.workoutHref(m.workout.id) : null } : null,
    };
  });
  return [...items, ...events].sort((a, b) => a.at - b.at);
}

/** « 18:30 », « hier », « 12 nov. » pour une liste de fils. */
export function whenShort(iso: string, tz: string): string {
  const l = utcToLocal(new Date(iso), tz);
  const today = todayIn(tz);
  if (l.date === today) return l.time;
  if (l.date === addDays(today, -1)) return 'hier';
  return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${l.date}T12:00:00Z`));
}
