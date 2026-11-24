import { describe, expect, it } from 'vitest';
import { importRosterSchema, parseRoster, parseWith, ROSTER_IMPORT_MAX } from './index';

describe('ajouter plusieurs élèves : lecture de la liste collée (D-169)', () => {
  it('lit une liste à puces de Google Docs, adresse où qu’elle soit', () => {
    const { rows, issues } = parseRoster(`Mes élèves trail 2026
• Marie Dupont – marie.dupont@gmail.com
- Paul Martin <Paul.Martin@Hotmail.fr>
1. Léa Bernard (lea@exemple.be)
2) Hugo Petit`);
    expect(issues.map((x) => [x.line, x.reason])).toEqual([[1, 'Ressemble à un titre, pas à un nom']]);
    expect(rows.map((r) => [r.displayName, r.email])).toEqual([
      ['Marie Dupont', 'marie.dupont@gmail.com'],
      ['Paul Martin', 'paul.martin@hotmail.fr'],
      ['Léa Bernard', 'lea@exemple.be'],
      ['Hugo Petit', null],
    ]);
  });

  it('écarte un titre de document, même accentué', () => {
    expect(parseRoster('Liste des élèves\nÉlèves du club\nMarie Roy').rows.map((r) => r.displayName)).toEqual(['Marie Roy']);
  });

  it('un intertitre donne leur groupe aux lignes suivantes', () => {
    const { rows, issues } = parseRoster('Ultra :\n- Ana Roy\n- Tom Roy – tom@x.fr\n\nGroupe Débutants\n- Zoé Ba ; zoe@x.fr ; Masters');
    expect(issues).toEqual([]);
    expect(rows.map((r) => [r.displayName, r.group])).toEqual([['Ana Roy', 'Ultra'], ['Tom Roy', 'Ultra'], ['Zoé Ba', 'Masters']]);
  });

  it('suit l’en-tête d’un tableur (tabulations), prénom et nom réunis, groupe', () => {
    const { rows, issues } = parseRoster('Prénom\tNom\tE-mail\tGroupe\nMarie\tDupont\tmarie@x.fr\tU16\nTom\tRoy\t\tMasters\n');
    expect(issues).toEqual([]);
    expect(rows).toEqual([
      { line: 2, displayName: 'Marie Dupont', email: 'marie@x.fr', group: 'U16' },
      { line: 3, displayName: 'Tom Roy', email: null, group: 'Masters' },
    ]);
  });

  it('un en-tête d’export Excel avec des colonnes en plus : elles sont ignorées', () => {
    const { rows, issues } = parseRoster('Nom;Prénom;Email;Formule;Téléphone\nMartin;Anna;anna@x.fr;Prise de masse;0470\nSimon;Bruno;;Remise en forme;');
    expect(issues).toEqual([]);
    expect(rows.map((r) => [r.displayName, r.email, r.group])).toEqual([['Anna Martin', 'anna@x.fr', null], ['Bruno Simon', null, null]]);
  });

  it('sans en-tête : nom, adresse puis groupe, séparés par des points-virgules', () => {
    expect(parseRoster('Inès Lambert; ines@x.be; Débutants').rows[0]).toEqual({ line: 1, displayName: 'Inès Lambert', email: 'ines@x.be', group: 'Débutants' });
  });

  it('écarte les doublons, les adresses invalides et les noms manquants, avec la ligne et la raison', () => {
    const { rows, issues } = parseRoster('Ana; ana@x.fr\nAna B; ANA@x.fr\nZoé\nZoé\n; bob@\n;zoe@x.fr');
    expect(rows.map((r) => r.displayName)).toEqual(['Ana', 'Zoé']);
    expect(issues.map((i) => [i.line, i.reason])).toEqual([
      [2, 'Même adresse que la ligne 1'],
      [4, 'Même nom que la ligne 3, sans adresse pour les distinguer'],
      [5, 'Adresse e-mail invalide'],
      [6, 'Nom manquant'],
    ]);
  });

  it('deux homonymes avec des adresses différentes sont gardés', () => {
    expect(parseRoster('Tom Roy, tom1@x.fr\nTom Roy, tom2@x.fr').rows).toHaveLength(2);
  });

  it(`s’arrête à ${ROSTER_IMPORT_MAX} élèves par ajout`, () => {
    const letter = (k: number) => String.fromCharCode(97 + k);
    const text = Array.from({ length: ROSTER_IMPORT_MAX + 3 }, (_, i) => `Élève ${letter(Math.floor(i / 26))}${letter(i % 26)}`).join('\n');
    const { rows, issues } = parseRoster(text);
    expect(rows).toHaveLength(ROSTER_IMPORT_MAX);
    expect(issues).toHaveLength(3);
  });

  it('le contrat refuse une liste vide, une adresse invalide ou un fuseau inconnu', () => {
    expect(parseWith(importRosterSchema, { timeZone: 'Europe/Paris', rows: [] }).ok).toBe(false);
    expect(parseWith(importRosterSchema, { timeZone: 'Europe/Paris', rows: [{ displayName: 'A', email: 'pas-une-adresse' }] }).ok).toBe(false);
    expect(parseWith(importRosterSchema, { timeZone: 'Mars/Base', rows: [{ displayName: 'A' }] }).ok).toBe(false);
    expect(parseWith(importRosterSchema, { timeZone: 'Europe/Paris', rows: [{ displayName: ' A ', email: 'A@X.FR', group: '  ' }] })).toEqual({
      ok: true, value: { timeZone: 'Europe/Paris', rows: [{ displayName: 'A', email: 'a@x.fr', group: null }] },
    });
  });
});
