import { describe, expect, it } from 'vitest';
import { categoryOf, IMPORT_EXAMPLE, metersOf, minutesOf, previewImport, splitTable } from './index';

// D-079 : import de la base d’un coach (CSV, cellules de tableur, lignes « Titre : séance »).

describe('import de séances (D-079)', () => {
  it('exemple CSV point-virgule : colonnes reconnues, séances structurées', () => {
    const p = previewImport(IMPORT_EXAMPLE, { defaultSport: 'running' });
    expect(p.format).toBe('table');
    expect(p.separator).toBe(';');
    expect(p.columns.map((c) => c.role)).toEqual(['title', 'sport', 'category', 'structure', 'instructions']);
    expect(p.rows).toHaveLength(4);
    expect(p.rows.every((r) => r.errors.length === 0 && r.workout)).toBe(true);
    expect(p.rows.map((r) => r.category)).toEqual(['endurance', 'intervals', 'threshold', 'endurance']);
    expect(p.rows[3]!.workout!.sport).toBe('cycling');
    expect(p.rows[1]!.workout!.intervals.length).toBe(3);
    expect(p.rows[0]!.minutes).toBe(45);
    expect(p.rows.map((r) => r.line)).toEqual([2, 3, 4, 5]);
  });

  it('cellules copiées d’un tableur (tabulations), texte libre gardé en consignes, doublons signalés', () => {
    const text = 'Nom\tType\tDétail\tDurée\nFooting\tEF\tcourir tranquille en aisance respiratoire\t50 min\nFooting\t\t40\' Z2\t\nRenfo\tPPG\t\t\n';
    const p = previewImport(text, { defaultSport: 'running', existing: ['renfo'] });
    expect(p.format).toBe('table');
    const [a, b, c] = p.rows;
    expect(a!.workout!.intervals).toEqual([]);
    expect(a!.workout!.instructions).toContain('aisance respiratoire');
    expect(a!.workout!.durationSeconds).toBe(3000);
    expect(a!.category).toBe('endurance');
    expect(b!.duplicate).toBe('file');
    expect(c!.errors).toContain('Séance vide : ni structure, ni consignes, ni durée');
    expect(c!.duplicate).toBe('library');
    expect(c!.category).toBe('strength');
  });

  it('lignes « Titre : séance » ; erreur à sa ligne, sans perte silencieuse', () => {
    const p = previewImport('# ma base\nVMA 10x400 : 20\' Z1 + 10×(400m Z6 + R200m) + 10\' Z1\n\n45\' Z2\nN’importe quoi zz\n', { defaultSport: 'running' });
    expect(p.format).toBe('lines');
    expect(p.rows.map((r) => r.line)).toEqual([2, 4, 5]);
    expect(p.rows[0]!.title).toBe('VMA 10x400');
    expect(p.rows[0]!.category).toBe('intervals');
    expect(p.rows[1]!.workout!.intervals.length).toBe(1);
    expect(p.rows[2]!.workout).toBeNull();
    expect(p.rows[2]!.errors[0]).toMatch(/Séance non reconnue/);
  });

  it('CSV à guillemets et virgules, sport inconnu, fichier vide', () => {
    const rows = splitTable('Titre,Séance\n"Seuil, version longue","20\' Z1 + 2×(15\' Z4 + R3\')"\n', ',');
    expect(rows[1]).toEqual(['Seuil, version longue', '20\' Z1 + 2×(15\' Z4 + R3\')']);
    const p = previewImport('Titre,Sport,Séance\nA,ski,30\' Z2\n', { defaultSport: 'running' });
    expect(p.rows[0]!.errors[0]).toMatch(/Sport inconnu/);
    expect(previewImport('  ', { defaultSport: 'running' }).errors[0]).toMatch(/Rien à importer/);
  });

  it('durées, distances et catégories lues en français', () => {
    expect([minutesOf('45'), minutesOf('1h10'), minutesOf('1:05:00'), minutesOf("50'"), minutesOf('abc')]).toEqual([45, 70, 65, 50, null]);
    expect([metersOf('10'), metersOf('12,5 km'), metersOf('800 m'), metersOf('800')]).toEqual([10000, 12500, 800, 800]);
    expect([categoryOf('Sortie longue'), categoryOf('Côtes'), categoryOf('Seuil'), categoryOf('récup'), categoryOf('xyz')]).toEqual(['long', 'hills', 'threshold', 'recovery', null]);
  });
});
