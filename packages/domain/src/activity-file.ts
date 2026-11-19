import type { Sport } from './sports';

/**
 * Lecture d’un fichier d’activité de montre (CE-X-02, D-048) : FIT, TCX ou GPX.
 * Seul un résumé est extrait : sport, début, durée, distance. Fréquence cardiaque, puissance, positions et
 * toute autre mesure sont ignorées (aucune donnée de santé tant que le fondateur n’a pas décidé, D11).
 * La lecture se fait dans le navigateur de l’élève : le fichier n’est ni envoyé ni conservé.
 */

export type ActivityFormat = 'fit' | 'tcx' | 'gpx';
export const ACTIVITY_FORMAT_LABELS: Record<ActivityFormat, string> = { fit: 'FIT', tcx: 'TCX', gpx: 'GPX' };
export const ACTIVITY_MAX_BYTES = 25 * 1024 * 1024;

export interface ActivitySummary {
  format: ActivityFormat;
  sport: Sport | null;
  /** Début, ISO 8601 UTC. */
  startedAt: string | null;
  /** Temps en mouvement (chronomètre), sinon temps écoulé. */
  seconds: number | null;
  distanceM: number | null;
}

export type ActivityRead = { ok: true; summary: ActivitySummary } | { ok: false; error: string };

const FIT_EPOCH_S = Date.UTC(1989, 11, 31) / 1000;
const fitDate = (s: number) => new Date((s + FIT_EPOCH_S) * 1000).toISOString();

// ---------- FIT ----------

const CRC_TABLE = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
function crc16(b: Uint8Array, start: number, end: number): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    let t = CRC_TABLE[crc & 0xf]!;
    crc = ((crc >> 4) & 0x0fff) ^ t ^ CRC_TABLE[b[i]! & 0xf]!;
    t = CRC_TABLE[crc & 0xf]!;
    crc = ((crc >> 4) & 0x0fff) ^ t ^ CRC_TABLE[(b[i]! >> 4) & 0xf]!;
  }
  return crc;
}

interface FitDef { global: number; little: boolean; fields: [num: number, size: number][]; devBytes: number }
type Fields = Map<number, number>;

function fitSport(sport: number | undefined, sub: number | undefined): Sport | null {
  if (sport === 1) return sub === 3 ? 'trail' : 'running';
  if (sport === 2) return 'cycling';
  if (sport === 5) return 'swimming';
  return null;
}

function readFit(b: Uint8Array): ActivityRead {
  if (b.length < 14) return { ok: false, error: 'Fichier FIT trop court.' };
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const headerSize = b[0]!;
  if (headerSize !== 12 && headerSize !== 14) return { ok: false, error: 'Ce n’est pas un fichier FIT lisible.' };
  if (String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) !== '.FIT') return { ok: false, error: 'Ce n’est pas un fichier FIT lisible.' };
  const end = headerSize + dv.getUint32(4, true);
  if (end + 2 > b.length) return { ok: false, error: 'Fichier FIT incomplet : réessaie l’export depuis ta montre.' };
  if (crc16(b, 0, end) !== dv.getUint16(end, true)) return { ok: false, error: 'Fichier FIT abîmé (contrôle d’intégrité incorrect).' };

  const defs = new Map<number, FitDef>();
  let fileType: number | undefined;
  const sessions: Fields[] = [];
  const laps: Fields[] = [];
  let firstTs: number | null = null, lastTs: number | null = null, lastDist: number | null = null;
  const WANT: Record<number, number[]> = { 0: [0], 18: [2, 5, 6, 7, 8, 9], 19: [2, 7, 8, 9], 20: [253, 5] };

  let p = headerSize;
  let lastTimestamp = 0;
  while (p < end) {
    const h = b[p++]!;
    if ((h & 0x80) === 0 && (h & 0x40)) {
      // Définition (avec champs de développeur éventuels).
      const local = h & 0x0f;
      const little = b[p + 1] === 0;
      const global = little ? dv.getUint16(p + 2, true) : dv.getUint16(p + 2, false);
      const n = b[p + 4]!;
      p += 5;
      const fields: [number, number][] = [];
      for (let i = 0; i < n; i++) { fields.push([b[p]!, b[p + 1]!]); p += 3; }
      let devBytes = 0;
      if (h & 0x20) {
        const nd = b[p++]!;
        for (let i = 0; i < nd; i++) { devBytes += b[p + 1]!; p += 3; }
      }
      defs.set(local, { global, little, fields, devBytes });
      continue;
    }
    const compressed = (h & 0x80) !== 0;
    const local = compressed ? (h >> 5) & 0x03 : h & 0x0f;
    const d = defs.get(local);
    if (!d) return { ok: false, error: 'Fichier FIT illisible (message sans définition).' };
    const want = WANT[d.global];
    const f: Fields = new Map();
    for (const [num, size] of d.fields) {
      if (want?.includes(num) && (size === 1 || size === 2 || size === 4)) {
        const v = size === 1 ? b[p]! : size === 2 ? dv.getUint16(p, d.little) : dv.getUint32(p, d.little);
        const invalid = size === 1 ? 0xff : size === 2 ? 0xffff : 0xffffffff;
        if (v !== invalid) f.set(num, v);
      }
      if (num === 253 && size === 4) lastTimestamp = dv.getUint32(p, d.little);
      p += size;
    }
    p += d.devBytes;
    if (compressed) {
      const offset = h & 0x1f;
      let ts = (lastTimestamp & ~0x1f) + offset;
      if (offset < (lastTimestamp & 0x1f)) ts += 0x20;
      lastTimestamp = ts;
      if (d.global === 20) f.set(253, ts);
    }
    if (p > end) return { ok: false, error: 'Fichier FIT illisible (message tronqué).' };
    if (d.global === 0 && f.has(0)) fileType = f.get(0);
    else if (d.global === 18) sessions.push(f);
    else if (d.global === 19) laps.push(f);
    else if (d.global === 20) {
      const ts = f.get(253);
      if (ts !== undefined) { firstTs ??= ts; lastTs = ts; }
      if (f.has(5)) lastDist = f.get(5)!;
    }
  }

  if (fileType === 5) return { ok: false, error: 'Ce fichier est une séance à faire (programme), pas une activité réalisée.' };
  if (fileType === 6) return { ok: false, error: 'Ce fichier est un parcours, pas une activité réalisée.' };
  if (fileType !== undefined && fileType !== 4) return { ok: false, error: 'Ce fichier FIT ne contient pas d’activité.' };

  const parts = sessions.length ? sessions : laps;
  if (parts.length) {
    const sum = (k: number, scale: number) => {
      const vals = parts.map((x) => x.get(k)).filter((v): v is number => v !== undefined);
      return vals.length ? vals.reduce((a, v) => a + v, 0) / scale : null;
    };
    const timer = sum(8, 1000) ?? sum(7, 1000);
    const dist = sum(9, 100);
    const sports = new Set(sessions.map((s) => fitSport(s.get(5), s.get(6))));
    const start = parts[0]!.get(2);
    return {
      ok: true,
      summary: {
        format: 'fit', sport: sports.size === 1 ? [...sports][0]! : null, startedAt: start !== undefined ? fitDate(start) : firstTs !== null ? fitDate(firstTs) : null,
        seconds: timer !== null && timer > 0 ? Math.round(timer) : null, distanceM: dist !== null && dist > 0 ? Math.round(dist) : null,
      },
    };
  }
  if (firstTs !== null && lastTs !== null && lastTs > firstTs) {
    return { ok: true, summary: { format: 'fit', sport: null, startedAt: fitDate(firstTs), seconds: lastTs - firstTs, distanceM: lastDist ? Math.round(lastDist / 100) : null } };
  }
  return { ok: false, error: 'Aucune durée ni distance trouvée dans ce fichier.' };
}

// ---------- TCX / GPX (texte XML) ----------

const num = (s: string | undefined) => (s === undefined ? null : Number.isFinite(Number(s)) ? Number(s) : null);
const tag = (xml: string, name: string) => xml.match(new RegExp(`<(?:\\w+:)?${name}>\\s*([^<]*?)\\s*</(?:\\w+:)?${name}>`))?.[1];

function tcxSport(s: string | undefined): Sport | null {
  if (!s) return null;
  if (/^running$/i.test(s)) return 'running';
  if (/^biking$/i.test(s)) return 'cycling';
  return null;
}

function readTcx(xml: string): ActivityRead {
  const activities = [...xml.matchAll(/<(?:\w+:)?Activity\b[^>]*Sport="([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?Activity>/g)];
  if (!activities.length) return { ok: false, error: 'Aucune activité trouvée dans ce fichier TCX.' };
  let seconds = 0, meters = 0, start: string | null = null;
  const sports = new Set<Sport | null>();
  for (const [, sport, body] of activities) {
    sports.add(tcxSport(sport));
    start ??= tag(body!, 'Id') ?? null;
    for (const lap of body!.matchAll(/<(?:\w+:)?Lap\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?Lap>/g)) {
      start ??= lap[1]!.match(/StartTime="([^"]+)"/)?.[1] ?? null;
      const own = lap[2]!.replace(/<(?:\w+:)?Track>[\s\S]*?<\/(?:\w+:)?Track>/g, '');
      seconds += num(tag(own, 'TotalTimeSeconds')) ?? 0;
      meters += num(tag(own, 'DistanceMeters')) ?? 0;
    }
  }
  if (!seconds && !meters) return { ok: false, error: 'Aucune durée ni distance trouvée dans ce fichier TCX.' };
  const t = start ? Date.parse(start) : NaN;
  return {
    ok: true,
    summary: { format: 'tcx', sport: sports.size === 1 ? [...sports][0]! : null, startedAt: Number.isNaN(t) ? null : new Date(t).toISOString(), seconds: seconds ? Math.round(seconds) : null, distanceM: meters ? Math.round(meters) : null },
  };
}

function haversine(a: [number, number], b: [number, number]): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function readGpx(xml: string): ActivityRead {
  const pts = [...xml.matchAll(/<(?:\w+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?trkpt>/g)];
  if (pts.length < 2) return { ok: false, error: 'Aucun tracé daté dans ce fichier GPX.' };
  let meters = 0, first: number | null = null, last: number | null = null, prev: [number, number] | null = null;
  for (const [, attrs, body] of pts) {
    const lat = num(attrs!.match(/lat="([^"]+)"/)?.[1]), lon = num(attrs!.match(/lon="([^"]+)"/)?.[1]);
    if (lat !== null && lon !== null) { if (prev) meters += haversine(prev, [lat, lon]); prev = [lat, lon]; }
    const t = Date.parse(tag(body!, 'time') ?? '');
    if (!Number.isNaN(t)) { first ??= t; last = t; }
  }
  const type = tag(xml, 'type')?.toLowerCase();
  const sport: Sport | null = type ? (/run|course/.test(type) ? 'running' : /bik|cycl|vélo|velo/.test(type) ? 'cycling' : /swim|nat/.test(type) ? 'swimming' : null) : null;
  const seconds = first !== null && last !== null && last > first ? Math.round((last - first) / 1000) : null;
  if (!seconds && !meters) return { ok: false, error: 'Aucune durée ni distance trouvée dans ce fichier GPX.' };
  return { ok: true, summary: { format: 'gpx', sport, startedAt: first !== null ? new Date(first).toISOString() : null, seconds, distanceM: meters ? Math.round(meters) : null } };
}

/** Lit un fichier d’activité ; le format est reconnu au contenu, pas seulement au nom. */
export function readActivityFile(name: string, bytes: Uint8Array): ActivityRead {
  if (bytes.length > ACTIVITY_MAX_BYTES) return { ok: false, error: 'Fichier trop lourd (25 Mo au plus).' };
  if (bytes.length >= 12 && String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!) === '.FIT') return readFit(bytes);
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  if (/<(?:\w+:)?TrainingCenterDatabase\b/.test(head) || /\.tcx$/i.test(name)) return readTcx(new TextDecoder().decode(bytes));
  if (/<gpx\b/i.test(head) || /\.gpx$/i.test(name)) return readGpx(new TextDecoder().decode(bytes));
  return { ok: false, error: 'Format non reconnu : choisis un fichier .fit, .tcx ou .gpx exporté de ta montre ou de ton application.' };
}
