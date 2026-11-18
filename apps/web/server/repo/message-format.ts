import { addDays, formatLongDate, todayIn, utcToLocal } from '@coachos/domain';
import type { ThreadMessage } from './messages';

/** Libellés de jour et d’heure dans le fuseau du lecteur, calculés côté serveur. */
export function toUi(messages: ThreadMessage[], tz: string) {
  const today = todayIn(tz);
  return messages.map((m) => {
    const l = utcToLocal(new Date(m.createdAt), tz);
    const day = l.date === today ? 'Aujourd’hui' : l.date === addDays(today, -1) ? 'Hier' : formatLongDate(l.date);
    return {
      id: m.id, body: m.body, mine: m.mine, senderName: m.senderName, fromCoach: m.fromCoach, voiceId: m.voiceId, voiceDurationS: m.voiceDurationS,
      day, time: l.time, at: Date.parse(m.createdAt),
    };
  });
}

/** « 18:30 », « hier », « 12 nov. » pour une liste de fils. */
export function whenShort(iso: string, tz: string): string {
  const l = utcToLocal(new Date(iso), tz);
  const today = todayIn(tz);
  if (l.date === today) return l.time;
  if (l.date === addDays(today, -1)) return 'hier';
  return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${l.date}T12:00:00Z`));
}
