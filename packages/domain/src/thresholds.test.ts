import { describe, expect, it } from 'vitest';
import { parseSwimPace, personalTarget, stepEstimate, structureTotals, workoutToFit, zonePower, zoneSwimPace, type Block, type Step } from './index';
import { stepLevel } from './session-profile';

// D-055 (CE-B-03) : FTP (vélo) et CSS (natation) traduisent les zones pour l’élève.

const step = (over: Partial<Step>): Step => ({ type: 'step', phase: 'work', sport: null, measure: { kind: 'time', seconds: 600 }, intensity: { kind: 'zone', zone: 3 }, cadence: null, note: null, ...over });

describe('seuils FTP et CSS', () => {
  it('zones en watts et en allure de nage', () => {
    expect(zonePower(4, 250)).toEqual([230, 265]); // 91–105 % arrondis à 5 W
    expect(zonePower(2, 200)).toEqual([110, 150]);
    expect(zoneSwimPace(4, 105)).toEqual([111, 105]); // 95–100 % de la vitesse CSS
    expect(zoneSwimPace(2, 100)).toEqual([128, 114]);
  });

  it('cible personnelle selon le sport ; rien sans repère ; % FTP en watts', () => {
    const refs = { vmaKmh: 15, ftpW: 250, cssSecPer100: 105 };
    expect(personalTarget(step({ intensity: { kind: 'zone', zone: 4 } }), 'cycling', refs)).toBe('230 à 265 W');
    expect(personalTarget(step({ intensity: { kind: 'zone', zone: 4 } }), 'swimming', refs)).toBe('1:51 à 1:45 /100 m');
    expect(personalTarget(step({ intensity: { kind: 'zone', zone: 2 } }), 'running', refs)).toBe('6:09 à 5:43 /km');
    expect(personalTarget(step({ intensity: { kind: 'zone', zone: 4 } }), 'cycling', { vmaKmh: 15 })).toBeNull();
    expect(personalTarget(step({ intensity: { kind: 'power', unit: 'pct_ftp', min: 88, max: 94 } }), 'cycling', refs)).toBe('220 à 235 W');
    // Multisport : le sport de l’étape décide.
    expect(personalTarget(step({ sport: 'cycling', intensity: { kind: 'zone', zone: 2 } }), 'triathlon', refs)).toBe('140 à 190 W');
  });

  it('natation : la CSS estime durée et distance ; vélo sans vitesse estimée', () => {
    const swim: Block[] = [step({ measure: { kind: 'distance', meters: 400 }, intensity: { kind: 'zone', zone: 4 } })];
    const t = structureTotals(swim, { sport: 'swimming', refs: { vmaKmh: null, cssSecPer100: 100 } });
    expect(t.estimated).toBe(true);
    expect(t.seconds).toBeGreaterThan(400); // un peu plus lent que la CSS
    expect(t.seconds).toBeLessThan(420);
    expect(stepEstimate(step({}), 'cycling', { vmaKmh: null, ftpW: 250 }).meters).toBeNull();
  });

  it('niveau du graphique depuis des watts ou une allure de nage', () => {
    expect(stepLevel(step({ intensity: { kind: 'power', unit: 'w', min: 260, max: null } }), 'cycling', { vmaKmh: null, ftpW: 250 })).toEqual({ level: 4, known: true });
    expect(stepLevel(step({ intensity: { kind: 'pace', unit: 'per_100m', min: 97, max: null } }), 'swimming', { vmaKmh: null, cssSecPer100: 100 })).toEqual({ level: 5, known: true });
  });

  it('fichier FIT : zone de vélo en watts, zone de nage en vitesse', () => {
    const bytes = workoutToFit({ title: 'x', sport: 'cycling', blocks: [step({ intensity: { kind: 'zone', zone: 4 } })], refs: { vmaKmh: null, ftpW: 250 } });
    const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const u32 = (n: number) => hex(new Uint8Array(Uint32Array.of(n).buffer));
    // Cible puissance avec bornes 1230 et 1265 (W + 1000), petit-boutiste.
    expect(hex(bytes)).toContain(u32(1230) + u32(1265));
    const swim = hex(workoutToFit({ title: 'x', sport: 'swimming', blocks: [step({ intensity: { kind: 'zone', zone: 4 } })], refs: { vmaKmh: null, cssSecPer100: 100 } }));
    expect(swim).toContain(u32(Math.round((100 / 105) * 1000)) + u32(1000));
  });

  it('saisie de la CSS', () => {
    expect(parseSwimPace('1:45')).toBe(105);
    expect(parseSwimPace('1’45 /100 m')).toBe(105);
    expect(parseSwimPace('105')).toBe(105);
    expect(parseSwimPace('1:75')).toBeNull();
    expect(parseSwimPace('vite')).toBeNull();
  });
});
