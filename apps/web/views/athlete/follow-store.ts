/**
 * D-096 · D-166 · D-167 · Ce que « Suivre la séance » garde sur ce téléphone pour reprendre plus tard :
 * l’étape, les séries notées, le chronomètre de séance et la minuterie de l’étape en cours.
 */

function load(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function keep(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch { /* stockage indisponible */ }
}
function json<T>(key: string): T | null {
  try { return JSON.parse(load(key) ?? 'null') as T | null; } catch { return null; }
}

// ---------- Étape en cours ----------

export const followPosKey = (sid: string) => `coachos:suivre:${sid}`;
export function readPos(sid: string): number {
  const v = Number(load(followPosKey(sid)));
  return Number.isInteger(v) && v > 0 ? v : 0;
}

// ---------- Séries notées (D-096, M4) ----------

export type FollowLog = Record<number, { reps: number | null; kg: number | null }>;
export const followLogKey = (sid: string) => `coachos:suivre:${sid}:series`;
export function readFollowLog(sid: string): FollowLog {
  const v = json<unknown>(followLogKey(sid));
  return v && typeof v === 'object' ? (v as FollowLog) : {};
}

// ---------- Chronomètre de séance (D-166) ----------

export interface ClockState { startedAt: number | null; pausedAt: number | null; pausedMs: number; endedAt: number | null }
export const NO_CLOCK: ClockState = { startedAt: null, pausedAt: null, pausedMs: 0, endedAt: null };
export const followClockKey = (sid: string) => `coachos:suivre:${sid}:chrono`;
export function readClock(sid: string): ClockState {
  const v = json<Partial<ClockState>>(followClockKey(sid));
  return v && typeof v.startedAt === 'number' ? { ...NO_CLOCK, ...v } : NO_CLOCK;
}
export const elapsedOf = (c: ClockState, now: number) => (c.startedAt ? Math.max(0, (c.endedAt ?? c.pausedAt ?? now) - c.startedAt - c.pausedMs) : 0);
/** Durée mesurée par le chronomètre de « Suivre », pour préremplir le retour (null si la séance n’a pas été suivie). */
export function readFollowElapsed(sid: string): number | null {
  const c = readClock(sid);
  return c.startedAt ? elapsedOf(c, Date.now()) : null;
}
/** D-167 · Séance commencée sur ce téléphone et pas encore finie : on propose de la reprendre. */
export function followInProgress(sid: string): boolean {
  const c = readClock(sid);
  return c.startedAt !== null && c.endedAt === null;
}

// ---------- Minuterie de l’étape en cours (D-167) ----------

/** Heure de fin quand elle tourne, temps restant figé pendant une pause, secondes ajoutées (« +15 s »). */
export interface Run { endAt: number | null; frozen: number | null; extra: number }
export const followTimerKey = (sid: string) => `coachos:suivre:${sid}:minuterie`;
export function readRun(sid: string, i: number): Run | null {
  const v = json<Run & { i: number }>(followTimerKey(sid));
  if (!v || v.i !== i) return null;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return { endAt: num(v.endAt), frozen: num(v.frozen), extra: num(v.extra) ?? 0 };
}
export const writeRun = (sid: string, i: number, r: Run | null) => keep(followTimerKey(sid), r ? { i, ...r } : null);
