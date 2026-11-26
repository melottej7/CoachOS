import type { FollowChanges, FollowExtra, FollowSwap, FollowSwaps } from '@coachos/domain';

/**
 * D-096 · D-166 · D-167 · Ce que « Suivre la séance » garde sur ce téléphone pour reprendre plus tard :
 * l’étape, les séries notées, le chronomètre de séance, la minuterie de l’étape en cours et l’écran entre deux exercices.
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

/**
 * Heure de fin quand elle tourne, temps d’effort restant figé pendant une pause, secondes ajoutées (« +15 s »).
 * D-172 : `goAt`, fin de la mise en place (au départ et à chaque reprise après une pause) ; l’effort court de goAt à endAt.
 */
export interface Run { endAt: number | null; frozen: number | null; extra: number; goAt: number | null }
export const followTimerKey = (sid: string) => `coachos:suivre:${sid}:minuterie`;
export function readRun(sid: string, i: number): Run | null {
  const v = json<Run & { i: number }>(followTimerKey(sid));
  if (!v || v.i !== i) return null;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return { endAt: num(v.endAt), frozen: num(v.frozen), extra: num(v.extra) ?? 0, goAt: num(v.goAt) };
}
export const writeRun = (sid: string, i: number, r: Run | null) => keep(followTimerKey(sid), r ? { i, ...r } : null);

// ---------- Écran entre deux exercices (D-172) ----------

/** L’étape devant laquelle l’élève se prépare, et l’exercice qu’il vient de finir (pour le féliciter). */
export interface Gate { at: number; after: string | null }
export const followGateKey = (sid: string) => `coachos:suivre:${sid}:pret`;
export function readGate(sid: string): Gate | null {
  const v = json<Partial<Gate>>(followGateKey(sid));
  return v && typeof v.at === 'number' && Number.isInteger(v.at) ? { at: v.at, after: typeof v.after === 'string' ? v.after : null } : null;
}

/** D-172 · Exercices passés (rang dans la séance), rappelés en fin de séance pour que l’élève le dise à son coach. */
export const followSkipKey = (sid: string) => `coachos:suivre:${sid}:passes`;
export function readSkipped(sid: string): number[] {
  const v = json<unknown>(followSkipKey(sid));
  return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : [];
}

// ---------- Autre ordre, remplacements, ajouts (D-182) ----------

/** Parties terminées (rang), pour reprendre dans le bon ordre quand l’élève a commencé par une autre machine. */
export const followDoneKey = (sid: string) => `coachos:suivre:${sid}:faits`;
export function readDoneParts(sid: string): number[] {
  const v = json<unknown>(followDoneKey(sid));
  return Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : [];
}
export const followSwapKey = (sid: string) => `coachos:suivre:${sid}:remplacements`;
export function readSwaps(sid: string): FollowSwaps {
  const v = json<unknown>(followSwapKey(sid));
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: FollowSwaps = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const o = x as Partial<FollowSwap> | null;
    if (o && typeof o.name === 'string' && o.name.trim() && typeof o.from === 'string') {
      out[k] = { name: o.name.slice(0, 80), from: o.from, exerciseId: typeof o.exerciseId === 'string' ? o.exerciseId : null, starterKey: typeof o.starterKey === 'string' ? o.starterKey : null };
    }
  }
  return out;
}
export const followExtraKey = (sid: string) => `coachos:suivre:${sid}:ajouts`;
export function readExtras(sid: string): FollowExtra[] {
  const v = json<unknown>(followExtraKey(sid));
  if (!Array.isArray(v)) return [];
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null);
  return v.flatMap((x) => {
    const o = x as Partial<FollowExtra> | null;
    if (!o || typeof o.name !== 'string' || !o.name.trim()) return [];
    return [{ name: o.name.slice(0, 80), exerciseId: typeof o.exerciseId === 'string' ? o.exerciseId : null, starterKey: typeof o.starterKey === 'string' ? o.starterKey : null,
      sets: Math.max(1, Math.min(30, Math.round(num(o.sets) ?? 1))), reps: num(o.reps), kg: num(o.kg) }];
  }).slice(0, 20);
}
/** Ce qui a changé pendant la séance, pour le retour. */
export function readFollowChanges(sid: string): FollowChanges {
  return { skippedParts: readSkipped(sid), swaps: readSwaps(sid), extras: readExtras(sid) };
}
/** Retour envoyé : le téléphone oublie la séance suivie. */
export function forgetFollow(sid: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k === followPosKey(sid) || k.startsWith(`${followPosKey(sid)}:`))) localStorage.removeItem(k);
    }
  } catch { /* stockage indisponible */ }
}
