// Dates locales de planification. Une séance porte une date ISO (YYYY-MM-DD) et un fuseau IANA.
// Les calculs de semaine se font sur la date civile, jamais sur un instant UTC,
// pour rester stables lors des changements d’heure.

export type LocalDate = string; // YYYY-MM-DD

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): value is LocalDate {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isTimeZone(value: string): boolean {
  if (!value || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Date civile courante dans un fuseau donné. */
export function todayIn(timeZone: string, now: Date = new Date()): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toUtcNoon(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function fromUtc(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const value = toUtcNoon(date);
  value.setUTCDate(value.getUTCDate() + days);
  return fromUtc(value);
}

/** Lundi de la semaine ISO qui contient la date. */
export function weekStart(date: LocalDate): LocalDate {
  const weekday = (toUtcNoon(date).getUTCDay() + 6) % 7; // lundi = 0
  return addDays(date, -weekday);
}

export function weekDates(monday: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const frDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', timeZone: 'UTC' });
const frLong = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const frShort = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const frMonth = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Lun. » */
export function formatWeekday(date: LocalDate): string {
  return capitalize(frDay.format(toUtcNoon(date)));
}

/** « Mardi 17 novembre » */
export function formatLongDate(date: LocalDate): string {
  return capitalize(frLong.format(toUtcNoon(date)));
}

/** « 17 nov. » */
export function formatShortDate(date: LocalDate): string {
  return frShort.format(toUtcNoon(date));
}

/** « 16–22 novembre 2026 » ou « 30 novembre – 6 décembre 2026 » */
export function formatWeekRange(monday: LocalDate): string {
  const sunday = addDays(monday, 6);
  const start = toUtcNoon(monday);
  const end = toUtcNoon(sunday);
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${frMonth.format(end)}`;
  }
  return `${frShort.format(start)} – ${frShort.format(end)} ${end.getUTCFullYear()}`;
}

export function dayOfMonth(date: LocalDate): number {
  return toUtcNoon(date).getUTCDate();
}
