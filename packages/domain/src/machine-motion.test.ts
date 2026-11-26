import { describe, expect, it } from 'vitest';
import {
  athleteMotion, BODY, jointAngle, LOOP_SECONDS, MACHINE_EXERCISES, MACHINE_MOTIONS, machineExercise, motionStatus, motionSvg, poseAt, progressAt, type Pose,
} from './index';

// D-178 : un seul gabarit d’animation ; chaque exercice décrit son départ et son arrivée. Le geste est vérifié ici.
const frames = (key: string): Pose[] => Array.from({ length: 41 }, (_, i) => poseAt(MACHINE_MOTIONS[key]!, i / 40));
const knee = (p: Pose) => jointAngle(p.hip, p.knee, p.ankle);
const elbow = (p: Pose) => jointAngle(p.shoulder, p.elbow, p.hand);
const d = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('animations dessinées des machines', () => {
  it('chaque animation correspond à un exercice de la bibliothèque', () => {
    for (const k of Object.keys(MACHINE_MOTIONS)) expect(machineExercise(k), k).not.toBeNull();
  });

  it('chaque exercice de la bibliothèque des machines a son animation', () => {
    expect(MACHINE_EXERCISES.filter((e) => !MACHINE_MOTIONS[e.key]).map((e) => e.key)).toEqual([]);
  });

  it('les membres gardent leur longueur, mains et pieds restent sur la poignée ou la plateforme, à chaque image', () => {
    const bad: string[] = [];
    const worst: Record<string, number> = {};
    for (const k of Object.keys(MACHINE_MOTIONS)) {
      const L = { ...BODY, ...MACHINE_MOTIONS[k]!.limbs };
      for (const p of frames(k)) {
        expect(d(p.hip, p.knee)).toBeCloseTo(L.thigh, 3);
        expect(d(p.shoulder, p.elbow)).toBeCloseTo(L.upperArm, 3);
        expect(d(p.elbow, p.hand)).toBeCloseTo(L.forearm, 3);
        if (Math.abs(d(p.knee, p.ankle) - L.shin) > 0.5) bad.push(`${k} : pied hors d’atteinte`);
        worst[k] = Math.max(worst[k] ?? 0, p.reach, Math.abs(d(p.knee, p.ankle) - L.shin));
        if (p.reach > 0.5) bad.push(`${k} : main hors d’atteinte`);
      }
    }
    expect([...new Set(bad)].map((b) => `${b} (${worst[b.split(' : ')[0]!]!.toFixed(1)})`)).toEqual([]);
  });

  it('presse à cuisses : genoux jamais verrouillés en haut, 90° en bas, dos immobile', () => {
    const f = frames('presse-a-cuisses');
    expect(knee(f[0]!)).toBeGreaterThan(150);
    expect(knee(f[0]!)).toBeLessThan(172);
    expect(knee(f[40]!)).toBeGreaterThan(82);
    expect(knee(f[40]!)).toBeLessThan(98);
    expect(new Set(f.map((p) => p.shoulder.join())).size).toBe(1);
    // Les pieds restent sur la plateforme : trajet horizontal.
    expect(new Set(f.map((p) => p.ankle[1])).size).toBe(1);
  });

  it('tirage vertical : bras presque tendus en haut, barre au haut de la poitrine, buste peu incliné', () => {
    const f = frames('tirage-vertical');
    expect(elbow(f[0]!)).toBeGreaterThan(160);
    const end = f[40]!;
    expect(Math.abs(end.hand[1] - end.shoulder[1])).toBeLessThan(8); // à hauteur du haut de la poitrine
    expect(end.hand[0]).toBeGreaterThan(end.shoulder[0]); // devant le corps, jamais derrière la nuque
    expect(end.elbow[1]).toBeGreaterThan(end.shoulder[1]); // coudes descendus vers les hanches
    expect(Math.abs(MACHINE_MOTIONS['tirage-vertical']!.torso[1])).toBeLessThanOrEqual(20);
  });

  it('développé machine : poignées à hauteur de poitrine, bras presque tendus sans verrouiller', () => {
    const f = frames('developpe-machine');
    expect(elbow(f[0]!)).toBeLessThan(80);
    expect(elbow(f[40]!)).toBeGreaterThan(160);
    expect(elbow(f[40]!)).toBeLessThan(179);
    for (const p of f) expect(Math.abs(p.hand[1] - p.shoulder[1])).toBeLessThan(12);
  });

  it('boucle de 4 s : arrêt, effort en 1,2 s, arrêt, retour freiné en 2 s', () => {
    expect(LOOP_SECONDS).toBe(4);
    const pull = MACHINE_MOTIONS['tirage-vertical']!;
    expect(progressAt(pull, 0.1)).toBe(0);
    expect(progressAt(pull, (0.5 + 1.2 + 0.1) / 4)).toBe(1);
    expect(progressAt(pull, 0.99)).toBeLessThan(0.05);
    // Presse : l’effort est la remontée ; la descente (freinée) dure 2 s.
    const press = MACHINE_MOTIONS['presse-a-cuisses']!;
    expect(progressAt(press, (0.5 + 1.0) / 4)).toBeLessThan(1);
    expect(progressAt(press, (0.5 + 2.0 + 0.1) / 4)).toBe(1);
  });

  it('un SVG animé de moins de 150 Ko (cible : 1 Mo), et son image d’aperçu sans animation', () => {
    for (const m of Object.values(MACHINE_MOTIONS)) {
      const svg = motionSvg(m, { title: 'Essai <b>' });
      expect(svg.length).toBeLessThan(150_000);
      expect(svg).toContain('repeatCount="indefinite"');
      expect(svg).not.toContain('<b>');
      expect(motionSvg(m, { still: true })).not.toContain('<animate');
    }
  });

  it('aucune animation n’est montrée à un élève avant validation', () => {
    expect(motionStatus('tirage-vertical')).toBe('to_review');
    expect(athleteMotion('tirage-vertical')).toBeNull();
    expect(athleteMotion('tirage-vertical', { 'tirage-vertical': { validatedBy: 'fondateur', validatedOn: '2026-11-26' } })).not.toBeNull();
    expect(motionStatus('inconnu')).toBeNull();
  });
});
