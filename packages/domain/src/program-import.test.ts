import { describe, expect, it } from 'vitest';
import { normalizeCoachWriting, parseNotation, previewImport, previewProgramImport, programTemplateDays, structureSchema, toNotation } from './index';

// D-085 : écriture libre du coach et import d’un ancien programme. Exemples tirés de programmes réels du fondateur
// (structures de séances seulement, sans nom ni donnée d’élève).

const read = (s: string) => {
  const r = parseNotation(s, 'running', { lenient: true });
  return { ...r, text: r.errors.length ? null : toNotation(r.blocks, 'running') };
};

describe('lecture tolérante de l’écriture du coach (D-085)', () => {
  it('lit les formes réelles : zones en fourchette, EF, allures sans @, temps de passage, récup entre parenthèses', () => {
    expect(read("Footing 45' Z1-Z2 ok").text).toBe("45' Z2");
    expect(read("15' Z1 + 3*(2km 4’40 + 400m Z1) + 10' Z1").text).toBe("15' Z1 + 3×(2km @4'40/km + 400m Z1) + 10' Z1");
    expect(read("20' Z1 + 8×(400m 1’25’’ + 200m Z1) + 20' Z1").text).toBe("20' Z1 + 8×(400m @3'33/km + 200m Z1) + 20' Z1");
    expect(read('15 min EF + 6x800m à 4:30/km (récup 1’30) + 10 min EF').text).toBe("15' Z2 + 6×(800m @4'30/km + R1'30) + 10' Z2");
    expect(read('Ef 20’ + 6*2km 4:15-20 R400m + 10’ ef').text).toBe("20' Z2 + 6×(2km @4'20-4'15/km + R400m) + 10' Z2");
    expect(read("2×30' de course séparés par R2' (~6,5–7 km)").text).toBe("2×(30' + R2')");
    expect(read('15’ Ef 4*1500m 4:45 R2’ + 15’ Ef').text).toBe("15' Z2 + 4×(1,5km @4'45/km + R2') + 15' Z2");
  });

  it('course/marche, pyramide, côtes, lignes droites : la marche échauffe ou récupère, les mots restent en note', () => {
    expect(read("10’ marche + 8×(1' course + R1'30) (20')").text).toBe("échauffement 10' « marche » + 8×(1' + R1'30)");
    expect(read("15' Z1 + 1' – 2' – 3' – 2' – 1' Z4 avec R1' entre chaque + 10' Z1").text)
      .toBe("15' Z1 + 1' Z4 + R1' + 2' Z4 + R1' + 3' Z4 + R1' + 2' Z4 + R1' + 1' Z4 + 10' Z1");
    expect(read('15\' Z1 + 10×(30" en côte + R descente en trottinant) + 10\' Z1').text)
      .toBe('15\' Z1 + 10×(30" « côte » + Rlibre « descente en trottinant ») + 10\' Z1');
    expect(read("Footing 25' + lignes droites").text).toBe("25' Z2 « lignes droites »");
    expect(read('8×(20" + R40") à la fin').text).toBe('8×(20" + R40" « à la fin »)');
  });

  it('coquilles fréquentes corrigées ; un plafond cardiaque reste une consigne écrite (D-084)', () => {
    expect(read('15’’ Z1 + 3*(2km Z3+500m Z1) + 10’’ Z1').text).toBe("15' Z1 + 3×(2km Z3 + 500m Z1) + 10' Z1");
    expect(read('Footing reconnaissance 45’’ Z1').text).toBe("45' Z1 « reconnaissance »");
    expect(read('Recup 20’ 3km').text).toBe("R20' « 3km »");
    const hr = parseNotation("Footing 25' < 160 bpm", 'running', { lenient: true });
    expect(hr.blocks[0]).toMatchObject({ intensity: { kind: 'zone', zone: 2 }, note: 'sous 160 bpm' });
  });

  it('les blocs lus sont valides ; l’éditeur reste strict', () => {
    for (const s of ["Footing 45' Z1-Z2", '15 min EF + 3x2000m à 4:50/km (récup 3’) + 10 min EF', "5’ marche 4*(1km + 2’ marche)"]) {
      const r = parseNotation(s, 'running', { lenient: true });
      expect(r.errors).toEqual([]);
      expect(structureSchema.safeParse(r.blocks).success).toBe(true);
    }
    expect(parseNotation("Footing 45' Z1-Z2", 'running').errors.length).toBeGreaterThan(0);
    expect(normalizeCoachWriting('Ef 1h40 Z1')).toBe('1h40 Z1');
  });

  it('import de la bibliothèque : une écriture libre devient structurée, le texte d’origine reste en consigne', () => {
    const p = previewImport("Fract long : 15' Z1 + 3*(2km 4'40 + 400m Z1) + 10' Z1\nN’importe quoi zz", { defaultSport: 'running' });
    expect(p.rows[0]!.workout!.intervals).toHaveLength(3);
    expect(p.rows[0]!.workout!.instructions).toContain("Texte d’origine : 15' Z1 + 3*(2km 4'40 + 400m Z1) + 10' Z1");
    expect(p.rows[1]!.workout).toBeNull();
  });
});

/** Programme fictif écrit comme ceux du fondateur : plan en tête, tableau de repères, semaines, consignes. */
const PROGRAM = [
  'Programme 10 km – 4 semaines',
  'Objectif : finir le 10 km du dimanche, en forme.',
  'Structure',
  'S1–S2 · Reprise : course/marche.',
  'S4 · Affûtage : on récupère et on court dimanche.',
  'Repères',
  'Zone\tAllure\tSensation',
  'Footing\t6:45 - 7:15 /km\ttu peux parler',
  'Vue d’ensemble',
  'S1\tfooting 30\'\tSL 40\'',
  'S1 · Réveil',
  "Séance 1 : 10’ marche + 8×(1' course + R1'30) (20').",
  'Rester facile sur la minute de course.',
  "Séance 2 · Footing 30' Z1-2 : test d'aisance, respire par le nez.",
  "Séance 3 (week-end) : Sortie longue 40' Z1-2.",
  'S2 · Fondations',
  "Mar · Footing 30' Z1-2",
  "Jeu · Fractionné (≈ 45') : 15' Z1 + 8×(200m Z5 + R200m) + 10' Z1. La dernière aussi rapide que la première.",
  'Ven : repos',
  "Dim · Sortie longue 50' Z1-2",
  'S3 · Pic',
  'Footing 35’ Z1-2',
  'Fract long : 15\' Z1 + 3*(2km 4’40 + 400m Z1) + 10\' Z1',
  'Séance bonus : 30’ de vélo',
  'Endurance 1H10 Z1',
  'Semaine de course · Affûtage',
  "Footing 25' + lignes droites : à la fin, 4×(20\" + R40\")",
  'Samedi : repos',
  'Dimanche 17 : COURSE 10 km',
].join('\n');

describe('import d’un ancien programme (D-085)', () => {
  it('plan et tableaux ignorés ; semaines, séances, jours et consignes retrouvés', () => {
    const p = previewProgramImport(PROGRAM, { defaultSport: 'running' });
    expect(p.errors).toEqual([]);
    expect(p.programs).toHaveLength(1);
    const g = p.programs[0]!;
    expect(g.title).toBe('Programme 10 km – 4 semaines');
    expect(g.weeks.map((w) => w.number)).toEqual([1, 2, 3, 4]);
    expect(g.weeks.map((w) => w.sessions.length)).toEqual([3, 3, 4, 2]);
    const [s1, s2, s3, s4] = g.weeks;
    // Sans jour écrit : l’ordre du document, la dernière le dimanche.
    expect(s1!.sessions.map((s) => s.day)).toEqual([2, 4, 7]);
    expect(s1!.sessions[0]!.instructions).toBe('Rester facile sur la minute de course.');
    expect(s1!.sessions[1]!.instructions).toContain('respire par le nez');
    expect(toNotation(s1!.sessions[0]!.blocks, 'running')).toBe("échauffement 10' « marche » + 8×(1' + R1'30)");
    // Jours écrits gardés ; « repos » n’est pas une séance.
    expect(s2!.sessions.map((s) => [s.day, s.dayGiven])).toEqual([[2, true], [4, true], [7, true]]);
    expect(s2!.sessions[1]!.instructions).toBe('La dernière aussi rapide que la première.');
    expect(s3!.sessions.find((s) => s.optional)?.sport).toBe('cycling');
    expect(s3!.sessions.find((s) => s.optional)?.title).toMatch(/optionnelle/);
    // Semaine sans numéro après S3 ; course le jour écrit, séance d’avant placée avant elle.
    expect(s4!.sessions.map((s) => s.day)).toEqual([3, 7]);
    expect(toNotation(s4!.sessions[0]!.blocks, 'running')).toBe("25' Z2 « lignes droites » + 4×(20\" + R40\")");
    // Jours de la semaine type : semaine 2, jeudi = 7 + 3.
    const days = programTemplateDays(g);
    expect(days.find((d) => d.workout.title.startsWith('Fractionné'))!.offset).toBe(10);
    expect(days).toHaveLength(12);
    expect(programTemplateDays(g, new Set([s3!.sessions[2]!.line]))).toHaveLength(11);
  });

  it('plusieurs programmes dans un document : la numérotation qui repart en ouvre un nouveau', () => {
    const text = `Préparation semi\nS1\nFooting 30'\nS2\nFooting 35'\nObjectif marathon\nS1\nEndurance 1h\nS2\nEndurance 1h10`;
    const p = previewProgramImport(text, { defaultSport: 'running' });
    expect(p.programs.map((x) => [x.title, x.weeks.length])).toEqual([['Préparation semi', 2], ['Objectif marathon', 2]]);
  });

  it('plus de 12 semaines signalé ; texte sans semaine refusé', () => {
    const long = Array.from({ length: 14 }, (_, i) => `S${i + 1}\nFooting 30'`).join('\n');
    expect(previewProgramImport(long, { defaultSport: 'running' }).programs[0]!.errors[0]).toMatch(/12 au plus/);
    expect(previewProgramImport("Footing 30'", { defaultSport: 'running' }).errors[0]).toMatch(/Aucune semaine/);
    expect(previewProgramImport('', { defaultSport: 'running' }).errors[0]).toMatch(/Rien à importer/);
  });
});
