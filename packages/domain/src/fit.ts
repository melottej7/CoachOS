import { usesVma, zonePace, PHASE_LABELS, ZONE_NAMES, type Block, type References, type Step, type Zone } from './structure';
import type { Sport } from './sports';

/**
 * Export d’une séance au format FIT « workout » (CE-X-01, D-044), lisible par Garmin Connect et les montres.
 * Correspondance (COUVERTURE, D-023) : étape → workout_step ; répétition → étape « répéter jusqu’à » placée après
 * les étapes répétées ; durée en ms, distance en cm ; zone de course + VMA → vitesse cible (mm/s) ;
 * allure → vitesse ; puissance et FC → cibles personnalisées ; RPE et cadence hors cible → note de l’étape.
 * Une zone sans VMA (ou hors course) reste une cible libre : les zones de la montre (5 en FC) ne sont pas les 7 du coach.
 * Aucune dépendance : en-tête de 14 octets, messages de définition puis de données, contrôle CRC FIT.
 */

export const FIT_MIME = 'application/vnd.ant.fit';
const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);
const PROFILE_VERSION = 2159;

// Types de base FIT.
const ENUM = 0x00, UINT16 = 0x84, UINT32 = 0x86, STRING = 0x07;
const INVALID = { [ENUM]: 0xff, [UINT16]: 0xffff, [UINT32]: 0xffffffff } as const;

// Énumérations du profil FIT utilisées ici.
const SPORT = { generic: 0, running: 1, cycling: 2, swimming: 5 } as const;
const SUB_SPORT = { generic: 0, trail: 3, lap_swimming: 17 } as const;
const DURATION = { time: 0, distance: 1, open: 5, repeat: 6 } as const;
const TARGET = { speed: 0, heart_rate: 1, open: 2, cadence: 3, power: 4 } as const;
const INTENSITY = { active: 0, rest: 1, warmup: 2, cooldown: 3, recovery: 4 } as const;

const STEP_NAME_BYTES = 24;
const NOTES_BYTES = 64;
const WKT_NAME_BYTES = 40;
/** Au-delà, certaines montres refusent la séance. */
export const FIT_MAX_STEPS = 100;

type FieldDef = readonly [num: number, size: number, base: number];

const CRC_TABLE = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
export function fitCrc(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    const b = bytes[i]!;
    let t = CRC_TABLE[crc & 0xf]!;
    crc = ((crc >> 4) & 0x0fff) ^ t ^ CRC_TABLE[b & 0xf]!;
    t = CRC_TABLE[crc & 0xf]!;
    crc = ((crc >> 4) & 0x0fff) ^ t ^ CRC_TABLE[(b >> 4) & 0xf]!;
  }
  return crc;
}

/** Chaîne UTF-8 tronquée sans couper un caractère, terminée par un zéro, sur `size` octets. */
function fitString(s: string, size: number): Uint8Array {
  const out = new Uint8Array(size);
  const enc = new TextEncoder();
  let used = 0;
  for (const ch of s) {
    const b = enc.encode(ch);
    if (used + b.length > size - 1) break;
    out.set(b, used);
    used += b.length;
  }
  return out;
}

class Writer {
  private chunks: number[] = [];
  u8(v: number) { this.chunks.push(v & 0xff); }
  u16(v: number) { this.u8(v); this.u8(v >>> 8); }
  u32(v: number) { this.u16(v & 0xffff); this.u16(v >>> 16); }
  bytes(b: Uint8Array) { for (const x of b) this.u8(x); }
  get length() { return this.chunks.length; }
  toArray() { return Uint8Array.from(this.chunks); }

  define(local: number, global: number, fields: readonly FieldDef[]) {
    this.u8(0x40 | local);
    this.u8(0); this.u8(0); // réservé, petit-boutiste
    this.u16(global);
    this.u8(fields.length);
    for (const [num, size, base] of fields) { this.u8(num); this.u8(size); this.u8(base); }
  }

  data(local: number, fields: readonly FieldDef[], values: Record<number, number | string | null | undefined>) {
    this.u8(local);
    for (const [num, size, base] of fields) {
      const v = values[num];
      if (base === STRING) this.bytes(fitString(typeof v === 'string' ? v : '', size));
      else {
        const n = typeof v === 'number' && Number.isFinite(v) ? v : INVALID[base as keyof typeof INVALID];
        if (size === 1) this.u8(n); else if (size === 2) this.u16(n); else this.u32(n);
      }
    }
  }
}

const FILE_ID: readonly FieldDef[] = [[0, 1, ENUM], [1, 2, UINT16], [2, 2, UINT16], [4, 4, UINT32]];
const WORKOUT: readonly FieldDef[] = [[8, WKT_NAME_BYTES, STRING], [4, 1, ENUM], [11, 1, ENUM], [6, 2, UINT16], [14, 2, UINT16], [15, 1, ENUM]];
const STEP: readonly FieldDef[] = [
  [254, 2, UINT16], [0, STEP_NAME_BYTES, STRING], [1, 1, ENUM], [2, 4, UINT32], [3, 1, ENUM], [4, 4, UINT32],
  [5, 4, UINT32], [6, 4, UINT32], [7, 1, ENUM], [8, NOTES_BYTES, STRING],
];

export interface FitStep {
  index: number;
  name: string;
  durationType: number;
  durationValue: number | null;
  targetType: number | null;
  targetValue: number | null;
  low: number | null;
  high: number | null;
  intensity: number | null;
  notes: string;
}

function sportOf(s: Sport): { sport: number; sub: number } {
  if (s === 'running') return { sport: SPORT.running, sub: SUB_SPORT.generic };
  if (s === 'trail') return { sport: SPORT.running, sub: SUB_SPORT.trail };
  if (s === 'cycling') return { sport: SPORT.cycling, sub: SUB_SPORT.generic };
  if (s === 'swimming') return { sport: SPORT.swimming, sub: SUB_SPORT.lap_swimming };
  return { sport: SPORT.generic, sub: SUB_SPORT.generic };
}

/** Sport unique de la séance (étapes comprises), sinon null (enchaînement de sports). */
function singleSport(blocks: Block[], session: Sport): Sport | null {
  const seen = new Set<Sport>();
  const walk = (bs: Block[]) => bs.forEach((b) => (b.type === 'step' ? seen.add(b.sport ?? session) : walk(b.steps)));
  walk(blocks);
  if (!seen.size) return session === 'triathlon' || session === 'duathlon' ? null : session;
  return seen.size === 1 ? [...seen][0]! : null;
}

const mmps = (secPerUnit: number, unitMeters: number) => Math.round((unitMeters / secPerUnit) * 1000);
const range = (min: number, max: number | null): [number, number] => [min, max ?? min];

/** Noms courts : l’écran de la montre affiche peu de caractères. */
const SHORT_SPORT: Record<Sport, string> = { running: 'Course', trail: 'Trail', cycling: 'Vélo', swimming: 'Nage', triathlon: 'Triathlon', duathlon: 'Duathlon' };

function rpeText(min: number, max: number | null) { return max && max !== min ? `Ressenti ${min} à ${max} sur 10` : `Ressenti ${min} sur 10`; }

function stepToFit(step: Step, index: number, session: Sport, multi: boolean, refs?: References): FitStep {
  const sport = step.sport ?? session;
  const notes: string[] = [];
  let name: string = PHASE_LABELS[step.phase];
  let targetType: number = TARGET.open;
  const targetValue = 0; // 0 = cible personnalisée (bornes basse et haute), ou cible libre
  let low: number | null = null;
  let high: number | null = null;
  const i = step.intensity;

  if (i.kind === 'zone') {
    const zone = i.zone as Zone;
    name += ` Z${zone}`;
    if (refs?.vmaKmh && usesVma(sport)) {
      const [slow, fast] = zonePace(zone, refs.vmaKmh);
      targetType = TARGET.speed; low = mmps(slow, 1000); high = mmps(fast, 1000);
    } else notes.push(`Zone ${zone} (${ZONE_NAMES[zone]})`);
  } else if (i.kind === 'pace') {
    const unit = i.unit === 'per_km' ? 1000 : 100;
    let [fast, slow] = range(i.min, i.max);
    if (fast === slow) { fast -= unit === 1000 ? 5 : 2; slow += unit === 1000 ? 5 : 2; }
    targetType = TARGET.speed; low = mmps(slow, unit); high = mmps(fast, unit);
  } else if (i.kind === 'power') {
    const [a, b] = range(i.min, i.max);
    targetType = TARGET.power;
    if (i.unit === 'w') { low = a + 1000; high = b + 1000; } else { low = Math.min(a, 1000); high = Math.min(b, 1000); }
  } else if (i.kind === 'hr') {
    const [a, b] = range(i.min, i.max);
    targetType = TARGET.heart_rate;
    if (i.unit === 'bpm') { low = a + 100; high = b + 100; } else { low = Math.min(a, 100); high = Math.min(b, 100); }
  } else if (i.kind === 'rpe') {
    notes.push(rpeText(i.min, i.max));
  }

  if (step.cadence) {
    const [a, b] = range(step.cadence.min, step.cadence.max);
    if (targetType === TARGET.open) { targetType = TARGET.cadence; low = a; high = b; }
    else notes.push(b !== a ? `Cadence ${a} à ${b}` : `Cadence ${a}`);
  }
  if (multi) name = `${SHORT_SPORT[sport]} · ${name}`;
  if (step.note) notes.push(step.note);

  const m = step.measure;
  return {
    index, name,
    durationType: m.kind === 'time' ? DURATION.time : m.kind === 'distance' ? DURATION.distance : DURATION.open,
    durationValue: m.kind === 'time' ? m.seconds * 1000 : m.kind === 'distance' ? m.meters * 100 : null,
    targetType, targetValue, low, high,
    intensity: { warmup: INTENSITY.warmup, work: INTENSITY.active, recovery: INTENSITY.recovery, cooldown: INTENSITY.cooldown, rest: INTENSITY.rest, other: INTENSITY.active }[step.phase],
    notes: notes.join(' · '),
  };
}

/** Étapes FIT dans l’ordre : chaque répétition suit ses étapes et renvoie à la première. */
export function fitSteps(blocks: Block[], sport: Sport, refs?: References): FitStep[] {
  const out: FitStep[] = [];
  const multi = singleSport(blocks, sport) === null;
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.type === 'step') out.push(stepToFit(b, out.length, sport, multi, refs));
      else {
        const from = out.length;
        walk(b.steps);
        out.push({ index: out.length, name: `Répéter ${b.times} fois`, durationType: DURATION.repeat, durationValue: from, targetType: null, targetValue: b.times, low: null, high: null, intensity: null, notes: '' });
      }
    }
  };
  walk(blocks);
  return out;
}

export interface FitWorkoutInput {
  title: string;
  sport: Sport;
  blocks: Block[];
  refs?: References;
  /** Horodatage du fichier ; par défaut maintenant. */
  createdAt?: Date;
  /** Séance sans blocs : une seule étape libre, avec ces consignes en note. */
  instructions?: string | null;
  durationSeconds?: number | null;
}

export function workoutToFit(input: FitWorkoutInput): Uint8Array {
  let steps = fitSteps(input.blocks, input.sport, input.refs);
  if (!steps.length) {
    const seconds = input.durationSeconds ?? null;
    steps = [{
      index: 0, name: 'Séance', durationType: seconds ? DURATION.time : DURATION.open, durationValue: seconds ? seconds * 1000 : null,
      targetType: TARGET.open, targetValue: 0, low: null, high: null, intensity: INTENSITY.active, notes: (input.instructions ?? '').replace(/\s+/g, ' ').trim(),
    }];
  }
  const kind = singleSport(input.blocks, input.sport);
  const { sport, sub } = sportOf(kind ?? 'triathlon');
  const swim = kind === 'swimming';

  const w = new Writer();
  w.define(0, 0, FILE_ID);
  w.data(0, FILE_ID, { 0: 5, 1: 255, 2: 0, 4: Math.max(0, Math.floor(((input.createdAt ?? new Date()).getTime() - FIT_EPOCH_MS) / 1000)) });
  w.define(1, 26, WORKOUT);
  w.data(1, WORKOUT, { 8: input.title, 4: sport, 11: sub, 6: steps.length, 14: swim ? 2500 : null, 15: swim ? 0 : null });
  w.define(2, 27, STEP);
  for (const s of steps) {
    w.data(2, STEP, {
      254: s.index, 0: s.name, 1: s.durationType, 2: s.durationValue, 3: s.targetType, 4: s.targetValue,
      5: s.low, 6: s.high, 7: s.intensity, 8: s.notes,
    });
  }
  const body = w.toArray();

  const out = new Uint8Array(14 + body.length + 2);
  const dv = new DataView(out.buffer);
  out[0] = 14; out[1] = 0x10;
  dv.setUint16(2, PROFILE_VERSION, true);
  dv.setUint32(4, body.length, true);
  out.set([0x2e, 0x46, 0x49, 0x54], 8); // « .FIT »
  dv.setUint16(12, fitCrc(out, 0, 12), true);
  out.set(body, 14);
  dv.setUint16(out.length - 2, fitCrc(out, 0, out.length - 2), true);
  return out;
}

/** Nom de fichier sûr : date et titre sans accents ni caractères spéciaux. */
export function fitFileName(localDate: string, title: string): string {
  const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase();
  return `${localDate}-${slug || 'seance'}.fit`;
}

/** Pourquoi l’export n’est pas disponible, ou null s’il l’est. */
export function fitUnavailableReason(blocks: Block[], canceled: boolean): string | null {
  if (canceled) return 'Séance annulée';
  if (fitSteps(blocks, 'running').length > FIT_MAX_STEPS) return `Plus de ${FIT_MAX_STEPS} étapes : trop longue pour une montre`;
  return null;
}
