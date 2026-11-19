import { describe, expect, it } from 'vitest';
import { readActivityFile } from './activity-file';
import { fitCrc, workoutToFit } from './fit';

// Fabrique de fichiers FIT d’activité pour les tests : définitions petit- ou grand-boutistes,
// champs de développeur, en-têtes d’horodatage compressés.
type F = [num: number, size: number, value: number];
class FitBuilder {
  private out: number[] = [];
  private put(n: number, size: number, little: boolean) {
    const bytes = [];
    for (let i = 0; i < size; i++) bytes.push((n / 2 ** (8 * i)) & 0xff);
    this.out.push(...(little ? bytes : bytes.reverse()));
  }
  message(local: number, global: number, fields: F[], opts: { big?: boolean; dev?: number[] } = {}) {
    const little = !opts.big;
    this.out.push(0x40 | local | (opts.dev ? 0x20 : 0), 0, little ? 0 : 1);
    this.put(global, 2, little);
    this.out.push(fields.length);
    for (const [n, s] of fields) this.out.push(n, s, s === 1 ? 0x00 : s === 2 ? 0x84 : 0x86);
    if (opts.dev) { this.out.push(opts.dev.length); for (const s of opts.dev) this.out.push(0, s, 0); }
    this.data(local, fields, opts);
    return this;
  }
  data(local: number, fields: F[], opts: { big?: boolean; dev?: number[] } = {}) {
    this.out.push(local);
    for (const [, s, v] of fields) this.put(v, s, !opts.big);
    if (opts.dev) for (const s of opts.dev) this.out.push(...new Array(s).fill(7));
    return this;
  }
  compressed(local: number, offset: number, values: number[], sizes: number[]) {
    this.out.push(0x80 | (local << 5) | offset);
    values.forEach((v, i) => this.put(v, sizes[i]!, true));
    return this;
  }
  build(corrupt = false): Uint8Array {
    const body = Uint8Array.from(this.out);
    const f = new Uint8Array(14 + body.length + 2);
    const dv = new DataView(f.buffer);
    f[0] = 14; f[1] = 0x20; dv.setUint16(2, 2159, true); dv.setUint32(4, body.length, true); f.set([0x2e, 0x46, 0x49, 0x54], 8);
    dv.setUint16(12, fitCrc(f, 0, 12), true);
    f.set(body, 14);
    dv.setUint16(f.length - 2, fitCrc(f, 0, f.length - 2) ^ (corrupt ? 1 : 0), true);
    return f;
  }
}
const T0 = Math.floor((Date.parse('2026-11-19T06:30:00Z') - Date.UTC(1989, 11, 31)) / 1000);

describe('lecture d’un fichier d’activité (CE-X-02)', () => {
  it('FIT avec session : sport, début, temps en mouvement, distance ; définition grand-boutiste et champs de développeur', () => {
    const f = new FitBuilder()
      .message(0, 0, [[0, 1, 4]])
      .message(1, 20, [[253, 4, T0], [5, 4, 0], [3, 1, 150]], { dev: [2, 1] }) // FC (champ 3) présente mais ignorée
      .message(2, 18, [[2, 4, T0], [5, 1, 1], [6, 1, 3], [7, 4, 3_000_000], [8, 4, 2_710_500], [9, 4, 812_345]], { big: true })
      .build();
    const r = readActivityFile('sortie.fit', f);
    expect(r).toEqual({ ok: true, summary: { format: 'fit', sport: 'trail', startedAt: '2026-11-19T06:30:00.000Z', seconds: 2711, distanceM: 8123 } });
    expect(JSON.stringify(r)).not.toMatch(/150/); // rien de la fréquence cardiaque
  });

  it('FIT sans session : durée et distance tirées des points, horodatages compressés compris', () => {
    const rec: F[] = [[253, 4, T0], [5, 4, 0]];
    const b = new FitBuilder().message(0, 0, [[0, 1, 4]]).message(1, 20, rec);
    // Points suivants en en-tête compressé (local 2) : seul le champ distance suit l’en-tête.
    const f = b.message(2, 20, [[5, 4, 0]]).compressed(2, (T0 + 10) & 0x1f, [1_000], [4]).compressed(2, (T0 + 40) & 0x1f, [12_000], [4]).build();
    const r = readActivityFile('a.fit', f);
    expect(r.ok && r.summary).toMatchObject({ format: 'fit', seconds: 40, distanceM: 120 });
  });

  it('FIT refusés : séance à faire, fichier abîmé, tronqué', () => {
    const workout = workoutToFit({ title: 'x', sport: 'running', blocks: [] });
    expect(readActivityFile('w.fit', workout)).toMatchObject({ ok: false, error: expect.stringContaining('séance à faire') });
    const ok = new FitBuilder().message(0, 0, [[0, 1, 4]]).message(1, 18, [[8, 4, 60_000]]).build();
    expect(readActivityFile('a.fit', ok).ok).toBe(true);
    expect(readActivityFile('a.fit', new FitBuilder().message(0, 0, [[0, 1, 4]]).message(1, 18, [[8, 4, 60_000]]).build(true))).toMatchObject({ ok: false, error: expect.stringContaining('abîmé') });
    expect(readActivityFile('a.fit', ok.subarray(0, ok.length - 6))).toMatchObject({ ok: false });
  });

  it('TCX : tours additionnés, distance du tour et non des points', () => {
    const tcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities>
      <Activity Sport="Running"><Id>2026-11-19T06:30:00Z</Id>
        <Lap StartTime="2026-11-19T06:30:00Z"><TotalTimeSeconds>1800.4</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters>
          <Track><Trackpoint><Time>2026-11-19T06:30:01Z</Time><DistanceMeters>3</DistanceMeters><HeartRateBpm><Value>151</Value></HeartRateBpm></Trackpoint></Track></Lap>
        <Lap StartTime="2026-11-19T07:00:00Z"><TotalTimeSeconds>900</TotalTimeSeconds><DistanceMeters>2500.6</DistanceMeters></Lap>
      </Activity></Activities></TrainingCenterDatabase>`;
    const r = readActivityFile('a.tcx', new TextEncoder().encode(tcx));
    expect(r).toEqual({ ok: true, summary: { format: 'tcx', sport: 'running', startedAt: '2026-11-19T06:30:00.000Z', seconds: 2700, distanceM: 7501 } });
  });

  it('GPX : durée entre premier et dernier point, distance le long du tracé', () => {
    // 0,01° de latitude ≈ 1 112 m.
    const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><type>running</type><trkseg>
      <trkpt lat="50.8500" lon="4.3500"><time>2026-11-19T06:30:00Z</time></trkpt>
      <trkpt lat="50.8550" lon="4.3500"><time>2026-11-19T06:33:00Z</time></trkpt>
      <trkpt lat="50.8600" lon="4.3500"><time>2026-11-19T06:36:00Z</time></trkpt></trkseg></trk></gpx>`;
    const r = readActivityFile('a.gpx', new TextEncoder().encode(gpx));
    expect(r.ok && r.summary).toMatchObject({ format: 'gpx', sport: 'running', seconds: 360, startedAt: '2026-11-19T06:30:00.000Z' });
    expect(r.ok && r.summary.distanceM).toBeGreaterThan(1100);
    expect(r.ok && r.summary.distanceM).toBeLessThan(1125);
  });

  it('format inconnu ou vide', () => {
    expect(readActivityFile('photo.jpg', new Uint8Array([0xff, 0xd8, 0xff]))).toMatchObject({ ok: false, error: expect.stringContaining('Format non reconnu') });
    expect(readActivityFile('a.gpx', new TextEncoder().encode('<gpx></gpx>'))).toMatchObject({ ok: false });
  });
});
