import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { readPalette } from './repo/palette';

// D-160 · Palette ⌘K : le coach de l’espace lit ses élèves, groupes et séances types ; personne d’autre.

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('palette du coach (D-160)', () => {
  it('le coach de l’espace voit ses élèves (fiche invitée signalée), sans élève d’un autre espace', async () => {
    const p = await readPalette(USERS.marine, WORKSPACE_A);
    expect(p).not.toBeNull();
    const ids = p!.athletes.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining([ATHLETES.camille, ATHLETES.noah, ATHLETES.ines]));
    expect(ids).not.toContain(ATHLETES.lea);
    expect(p!.athletes.find((a) => a.id === ATHLETES.ines)?.invited).toBe(true);
    expect(Array.isArray(p!.teams)).toBe(true);
    expect(Array.isArray(p!.templates)).toBe(true);
  });

  it('un élève ou le coach d’un autre espace n’obtient rien', async () => {
    expect(await readPalette(USERS.camille, WORKSPACE_A)).toBeNull();
    expect(await readPalette(USERS.hugo, WORKSPACE_A)).toBeNull();
  });
});
