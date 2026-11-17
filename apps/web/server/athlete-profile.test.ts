import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { readAthleteProfile, saveAthleteProfile } from './commands/athlete-profile';

// D-021 : profil sportif déclaré par l’athlète, lu par le coach affecté, sans donnée de santé.

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A });
const valid = {
  sport: 'trail', level: 'intermediate', experience: '1to3', weeklySessions: '2to3', weeklyHours: '2to4',
  availableDays: [6, 2, 2, 4], mainGoal: '  Finir un trail de 30 km  ', nextEventName: 'Trail des Fagnes', nextEventDate: '2027-04-18',
};
async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('profil sportif de l’athlète', () => {
  it('l’athlète enregistre son profil ; jours dédoublonnés et triés, texte nettoyé', async () => {
    const r = await saveAthleteProfile(meta(USERS.camille), valid);
    expect(r.body).toMatchObject({ item: { sport: 'trail', availableDays: [2, 4, 6], mainGoal: 'Finir un trail de 30 km', revision: 1 } });
    const again = await saveAthleteProfile(meta(USERS.camille), { ...valid, level: 'advanced' });
    expect(again.body).toMatchObject({ item: { level: 'advanced', revision: 2 } });
  });

  it('lecture : l’athlète et son coach affecté, personne d’autre', async () => {
    expect((await readAthleteProfile(USERS.camille, WORKSPACE_A, ATHLETES.camille))?.level).toBe('advanced');
    expect((await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.camille))?.sport).toBe('trail');
    expect(await readAthleteProfile(USERS.hugo, WORKSPACE_A, ATHLETES.camille)).toBeNull();
    expect(await readAthleteProfile(USERS.noah, WORKSPACE_A, ATHLETES.camille)).toBeNull();
    expect(await readAthleteProfile(USERS.lea, WORKSPACE_A, ATHLETES.camille)).toBeNull();
  });

  it('écriture : ni le coach, ni un athlète d’un autre espace', async () => {
    expect(await codeOf(saveAthleteProfile(meta(USERS.marine), valid))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(saveAthleteProfile(meta(USERS.lea), valid))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('refuse un champ inconnu (aucune donnée de santé cachée) et les valeurs hors liste', async () => {
    expect(await codeOf(saveAthleteProfile(meta(USERS.camille), { ...valid, injuries: 'genou' }))).toBe('INVALID_FIELDS');
    expect(await codeOf(saveAthleteProfile(meta(USERS.camille), { ...valid, level: 'elite' }))).toBe('INVALID_FIELDS');
    expect(await codeOf(saveAthleteProfile(meta(USERS.camille), { ...valid, availableDays: [8] }))).toBe('INVALID_FIELDS');
    expect(await codeOf(saveAthleteProfile(meta(USERS.camille), { ...valid, nextEventDate: '2027-02-30' }))).toBe('INVALID_FIELDS');
    const { sport: _sport, ...withoutSport } = valid;
    expect(await codeOf(saveAthleteProfile(meta(USERS.camille), withoutSport))).toBe('INVALID_FIELDS');
  });
});
