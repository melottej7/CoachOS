import { describe, expect, it } from 'vitest';
import { fitCrc, fitFileName, fitUnavailableReason, workoutToFit } from './fit';
import { parseNotation } from './notation';
import { zonePace, type Block } from './structure';

// Lecteur indépendant, écrit d’après la spécification FIT (en-tête, définitions, données, CRC),
// pour relire ce que l’encodeur écrit sans réutiliser son code.
interface Msg { global: number; fields: Record<number, number | string> }
function decode(bytes: Uint8Array): { header: { size: number; proto: number; dataSize: number; sig: string }; messages: Msg[]; crcOk: boolean; headerCrcOk: boolean } {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = bytes[0]!;
  const dataSize = dv.getUint32(4, true);
  const sig = String.fromCharCode(...bytes.slice(8, 12));
  const defs = new Map<number, { global: number; fields: [number, number, number][] }>();
  const messages: Msg[] = [];
  let p = size;
  const end = size + dataSize;
  while (p < end) {
    const h = bytes[p++]!;
    const local = h & 0x0f;
    if (h & 0x40) {
      p += 2;
      const global = dv.getUint16(p, true); p += 2;
      const n = bytes[p++]!;
      const fields: [number, number, number][] = [];
      for (let i = 0; i < n; i++) { fields.push([bytes[p]!, bytes[p + 1]!, bytes[p + 2]!]); p += 3; }
      defs.set(local, { global, fields });
    } else {
      const d = defs.get(local)!;
      const fields: Record<number, number | string> = {};
      for (const [num, sz, base] of d.fields) {
        if (base === 0x07) {
          const raw = bytes.slice(p, p + sz);
          const z = raw.indexOf(0);
          fields[num] = new TextDecoder('utf-8', { fatal: true }).decode(raw.slice(0, z < 0 ? sz : z));
        } else {
          const v = sz === 1 ? bytes[p]! : sz === 2 ? dv.getUint16(p, true) : dv.getUint32(p, true);
          const invalid = sz === 1 ? 0xff : sz === 2 ? 0xffff : 0xffffffff;
          if (v !== invalid) fields[num] = v;
        }
        p += sz;
      }
      messages.push({ global: d.global, fields });
    }
  }
  return {
    header: { size, proto: bytes[1]!, dataSize, sig },
    messages,
    headerCrcOk: fitCrc(bytes, 0, 12) === dv.getUint16(12, true),
    crcOk: p === end && end + 2 === bytes.length && fitCrc(bytes, 0, end) === dv.getUint16(end, true),
  };
}

const steps = (f: ReturnType<typeof decode>) => f.messages.filter((m) => m.global === 27).map((m) => m.fields);
const notation = (text: string, sport: 'running' | 'cycling' = 'running') => {
  const r = parseNotation(text, sport);
  expect(r.errors).toEqual([]);
  return r.blocks as Block[];
};

describe('export FIT (CE-X-01)', () => {
  it('fichier valide : en-tête, signature, taille, CRC ; file_id « séance » puis workout puis étapes', () => {
    const f = decode(workoutToFit({ title: 'Séries courtes', sport: 'running', blocks: notation("15' Z1 + 8×(400m Z5 + R200m) + 10' Z1"), createdAt: new Date('2026-11-19T06:00:00Z') }));
    expect(f.header).toMatchObject({ size: 14, proto: 0x10, sig: '.FIT' });
    expect(f.headerCrcOk).toBe(true);
    expect(f.crcOk).toBe(true);
    expect(f.messages.map((m) => m.global)).toEqual([0, 26, 27, 27, 27, 27, 27]);
    expect(f.messages[0]!.fields).toMatchObject({ 0: 5, 1: 255, 4: Math.floor((Date.parse('2026-11-19T06:00:00Z') - Date.UTC(1989, 11, 31)) / 1000) });
    expect(f.messages[1]!.fields).toMatchObject({ 8: 'Séries courtes', 4: 1, 11: 0, 6: 5 });
  });

  it('répétition après ses étapes, durées en ms, distances en cm, zone + VMA → vitesse', () => {
    const f = decode(workoutToFit({ title: 'x', sport: 'running', blocks: notation("15' Z1 + 8×(400m Z5 + R200m) + 10' Z1"), refs: { vmaKmh: 15 } }));
    const s = steps(f);
    expect(s.map((x) => [x[254], x[1], x[2]])).toEqual([[0, 0, 900_000], [1, 1, 40_000], [2, 1, 20_000], [3, 6, 1], [4, 0, 600_000]]);
    expect(s[3]![4]).toBe(8); // 8 répétitions
    const [slow, fast] = zonePace(5, 15);
    expect(s[1]).toMatchObject({ 0: 'Effort Z5', 3: 0, 4: 0, 5: Math.round((1000 / slow) * 1000), 6: Math.round((1000 / fast) * 1000), 7: 0 });
    expect(s[0]![7]).toBe(2); // échauffement
    expect(s[4]![7]).toBe(3); // retour au calme
    expect(s[2]![7]).toBe(4); // récupération
  });

  it('séries imbriquées : chaque répétition renvoie à sa première étape', () => {
    const s = steps(decode(workoutToFit({ title: 'x', sport: 'running', blocks: notation("2×(3×(400m Z6 + R1') + R3')") })));
    expect(s.map((x) => [x[1], x[2] ?? null, x[1] === 6 ? x[4] : null])).toEqual([
      [1, 40_000, null], [0, 60_000, null], [6, 0, 3], [0, 180_000, null], [6, 0, 2],
    ]);
  });

  it('sans VMA, la zone reste libre et nommée ; FC, puissance, RPE et cadence', () => {
    const blocks: Block[] = [
      { type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: 600 }, intensity: { kind: 'zone', zone: 3 }, cadence: null, note: null },
      { type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: 300 }, intensity: { kind: 'hr', unit: 'bpm', min: 150, max: 160 }, cadence: null, note: null },
      { type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: 300 }, intensity: { kind: 'hr', unit: 'pct_max', min: 80, max: 85 }, cadence: null, note: null },
      { type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: 300 }, intensity: { kind: 'power', unit: 'w', min: 250, max: null }, cadence: { min: 90, max: null }, note: null },
      { type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: 300 }, intensity: { kind: 'power', unit: 'pct_ftp', min: 95, max: 105 }, cadence: null, note: null },
      { type: 'step', phase: 'other', sport: null, measure: { kind: 'open' }, intensity: { kind: 'rpe', min: 6, max: 7 }, cadence: null, note: 'Bras relâchés' },
      { type: 'step', phase: 'rest', sport: null, measure: { kind: 'time', seconds: 60 }, intensity: { kind: 'none' }, cadence: { min: 85, max: 95 }, note: null },
    ];
    const s = steps(decode(workoutToFit({ title: 'x', sport: 'cycling', blocks, refs: { vmaKmh: 15 } })));
    expect(s[0]).toMatchObject({ 0: 'Effort Z3', 3: 2, 8: 'Zone 3 (tempo)' });
    expect(s[0]![5]).toBeUndefined();
    expect(s[1]).toMatchObject({ 3: 1, 5: 250, 6: 260 });
    expect(s[2]).toMatchObject({ 3: 1, 5: 80, 6: 85 });
    expect(s[3]).toMatchObject({ 3: 4, 5: 1250, 6: 1250, 8: 'Cadence 90' });
    expect(s[4]).toMatchObject({ 3: 4, 5: 95, 6: 105 });
    expect(s[5]).toMatchObject({ 1: 5, 3: 2, 8: 'Ressenti 6 à 7 sur 10 · Bras relâchés' });
    expect(s[5]![2]).toBeUndefined();
    expect(s[6]).toMatchObject({ 3: 3, 5: 85, 6: 95, 7: 1 });
  });

  it('allure seule : fourchette de ± 5 s/km ; sport, trail, natation (bassin de 25 m), enchaînement', () => {
    const pace: Block[] = [{ type: 'step', phase: 'work', sport: null, measure: { kind: 'distance', meters: 1000 }, intensity: { kind: 'pace', unit: 'per_km', min: 240, max: null }, cadence: null, note: null }];
    const s = steps(decode(workoutToFit({ title: 'x', sport: 'trail', blocks: pace })));
    expect(s[0]).toMatchObject({ 3: 0, 5: Math.round((1000 / 245) * 1000), 6: Math.round((1000 / 235) * 1000) });
    expect(decode(workoutToFit({ title: 'x', sport: 'trail', blocks: pace })).messages[1]!.fields).toMatchObject({ 4: 1, 11: 3 });
    const swim = decode(workoutToFit({ title: 'x', sport: 'swimming', blocks: [{ ...pace[0]!, measure: { kind: 'distance', meters: 100 }, intensity: { kind: 'pace', unit: 'per_100m', min: 100, max: 110 } }] as Block[] }));
    expect(swim.messages[1]!.fields).toMatchObject({ 4: 5, 11: 17, 14: 2500, 15: 0 });
    expect(steps(swim)[0]).toMatchObject({ 5: Math.round((100 / 110) * 1000), 6: 1000 });
    const tri: Block[] = [{ ...pace[0]!, sport: 'cycling', intensity: { kind: 'none' } } as Block, { ...pace[0]!, sport: 'running' } as Block];
    const t = decode(workoutToFit({ title: 'Enchaînement', sport: 'triathlon', blocks: tri }));
    expect(t.messages[1]!.fields).toMatchObject({ 4: 0 });
    expect(steps(t).map((x) => x[0])).toEqual(['Vélo · Effort', 'Course · Effort']);
  });

  it('séance sans blocs : une étape avec la durée et les consignes ; textes longs tronqués sans couper un caractère', () => {
    const long = 'Footing très facile avec des éducatifs à la fin, montées de genoux et talons-fesses — sans forcer';
    const f = decode(workoutToFit({ title: 'Récupération active à allure très très douce ✨✨✨', sport: 'running', blocks: [], instructions: long, durationSeconds: 2400 }));
    expect(f.crcOk).toBe(true);
    const s = steps(f);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ 1: 0, 2: 2_400_000, 3: 2 });
    expect(long.startsWith(s[0]![8] as string)).toBe(true);
    expect(new TextEncoder().encode(s[0]![8] as string).length).toBeLessThanOrEqual(63);
    expect(new TextEncoder().encode(f.messages[1]!.fields[8] as string).length).toBeLessThanOrEqual(39);
  });

  it('nom de fichier et disponibilité', () => {
    expect(fitFileName('2026-11-21', 'Séries courtes : 8 × 400 m')).toBe('2026-11-21-series-courtes-8-400-m.fit');
    expect(fitFileName('2026-11-21', '✨')).toBe('2026-11-21-seance.fit');
    expect(fitUnavailableReason([], true)).toBe('Séance annulée');
    expect(fitUnavailableReason([], false)).toBeNull();
  });
});
