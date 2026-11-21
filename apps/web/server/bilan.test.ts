import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { confirmBilan, readAthleteProfile, readBilanDraft, readBilanVersions, saveAthleteProfile, saveBilanByCoach, saveBilanDraft } from './commands/athlete-profile';

// D-054 : bilan d’arrivée (CE-B-04 brouillon, reprise, complétude, confirmation ; CE-B-05 entretien, provenance).

const meta = <E extends object = object>(actorId: string, extra: E = {} as E) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, ...extra });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const answers = { sport: 'running', practiceStatus: 'resumed', breakLength: '6to12m', resumedSince: '1to3m', experience: '1to3', weeklySessions: '2to3', longestRecent: '45to60', level: 'intermediate', mainGoal: 'Courir un 10 km' } as const;

beforeAll(async () => { setDb(await openDatabase()); });

describe('bilan d’arrivée', () => {
  it('brouillon sur le serveur : repris par l’élève, lisible par son coach seulement', async () => {
    await saveBilanDraft(meta(USERS.noah), { step: 'break', answers: { sport: 'running', practiceStatus: 'resumed', experience: '1to3' } });
    expect(await readBilanDraft(USERS.noah, WORKSPACE_A, ATHLETES.noah)).toMatchObject({ step: 'break', answers: { practiceStatus: 'resumed' } });
    expect(await readBilanDraft(USERS.marine, WORKSPACE_A, ATHLETES.noah)).toMatchObject({ step: 'break' });
    expect(await readBilanDraft(USERS.camille, WORKSPACE_A, ATHLETES.noah)).toBeNull();
    expect(await readBilanDraft(USERS.hugo, WORKSPACE_A, ATHLETES.noah)).toBeNull();
    expect(await codeOf(saveBilanDraft(meta(USERS.noah), { step: 'break', answers: { blessure: 'genou' } }))).toBe('INVALID_FIELDS');
  });

  it('envoi : brouillon effacé, statut « à confirmer », réponses déclarées ; incohérence refusée', async () => {
    expect(await codeOf(saveAthleteProfile(meta(USERS.noah), { ...answers, resumedSince: null }))).toBe('INVALID_FIELDS');
    await saveAthleteProfile(meta(USERS.noah), answers);
    expect(await readBilanDraft(USERS.noah, WORKSPACE_A, ATHLETES.noah)).toBeNull();
    const p = (await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.noah))!;
    expect(p).toMatchObject({ status: 'submitted', practiceStatus: 'resumed', breakLength: '6to12m', longestRecent: '45to60', confirmedAt: null });
    expect(p.sources).toMatchObject({ sport: 'athlete', level: 'athlete', mainGoal: 'athlete' });
  });

  it('confirmation par le coach ; une modification de l’élève la retire ; révision périmée refusée', async () => {
    const p = (await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.noah))!;
    expect(await codeOf(confirmBilan(meta(USERS.marine, { athleteId: ATHLETES.noah }), { expectedRevision: p.revision + 1 }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(confirmBilan(meta(USERS.noah, { athleteId: ATHLETES.noah }), { expectedRevision: p.revision }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(confirmBilan(meta(USERS.hugo, { athleteId: ATHLETES.noah }), { expectedRevision: p.revision }))).toBe('RESOURCE_NOT_VISIBLE');
    await confirmBilan(meta(USERS.marine, { athleteId: ATHLETES.noah }), { expectedRevision: p.revision });
    expect((await readAthleteProfile(USERS.noah, WORKSPACE_A, ATHLETES.noah))!).toMatchObject({ status: 'confirmed' });
    await saveAthleteProfile(meta(USERS.noah), { ...answers, weeklySessions: '4to5' });
    expect((await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.noah))!).toMatchObject({ status: 'submitted', weeklySessions: '4to5', confirmedAt: null });
  });

  it('entretien : le coach complète, réponses modifiées marquées « entretien », bilan confirmé ; conflit si l’élève a changé', async () => {
    const p = (await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.noah))!;
    const data = { ...answers, weeklySessions: '4to5', level: 'advanced', availableDays: [2, 4, 6] };
    expect(await codeOf(saveBilanByCoach(meta(USERS.marine, { athleteId: ATHLETES.noah }), { expectedRevision: p.revision - 1, data }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(saveBilanByCoach(meta(USERS.noah, { athleteId: ATHLETES.noah }), { expectedRevision: p.revision, data }))).toBe('RESOURCE_NOT_VISIBLE');
    await saveBilanByCoach(meta(USERS.marine, { athleteId: ATHLETES.noah }), { expectedRevision: p.revision, data });
    const after = (await readAthleteProfile(USERS.noah, WORKSPACE_A, ATHLETES.noah))!;
    expect(after).toMatchObject({ status: 'confirmed', level: 'advanced', availableDays: [2, 4, 6] });
    expect(after.sources).toMatchObject({ level: 'interview', availableDays: 'interview', sport: 'athlete', weeklySessions: 'athlete', mainGoal: 'athlete' });
  });

  it('entretien avant tout questionnaire : bilan créé par le coach (révision attendue nulle)', async () => {
    const data = { sport: 'cycling', practiceStatus: 'regular', experience: 'gt5', weeklySessions: '4to5', level: 'competitive' };
    expect(await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.camille)).toBeNull();
    await saveBilanByCoach(meta(USERS.marine, { athleteId: ATHLETES.camille }), { expectedRevision: null, data });
    const p = (await readAthleteProfile(USERS.camille, WORKSPACE_A, ATHLETES.camille))!;
    expect(p).toMatchObject({ status: 'confirmed', sport: 'cycling' });
    expect(Object.values(p.sources).every((s) => s === 'interview')).toBe(true);
  });

  it('renvoyer le même bilan ne retire pas la confirmation (ex. seul le nom a changé)', async () => {
    const p = (await readAthleteProfile(USERS.noah, WORKSPACE_A, ATHLETES.noah))!;
    expect(p.status).toBe('confirmed');
    const { status: _s, confirmedAt: _c, sources: _src, revision: _r, updatedAt: _u, ...data } = p;
    await saveAthleteProfile(meta(USERS.noah), data);
    expect((await readAthleteProfile(USERS.noah, WORKSPACE_A, ATHLETES.noah))!).toMatchObject({ status: 'confirmed', revision: p.revision });
  });

  it('historique (D-059) : une version par enregistrement, avec les réponses changées et leur source', async () => {
    const v = await readBilanVersions(USERS.marine, WORKSPACE_A, ATHLETES.noah);
    expect(v.length).toBeGreaterThanOrEqual(3);
    expect(v.map((x) => x.revision)).toEqual([...v.map((x) => x.revision)].sort((a, b) => b - a));
    const interview = v.find((x) => x.source === 'interview')!;
    expect(interview.changed).toEqual(expect.arrayContaining(['level', 'availableDays']));
    expect(v.at(-1)!.changed).toEqual([]); // première version
    expect(await readBilanVersions(USERS.camille, WORKSPACE_A, ATHLETES.noah)).toEqual([]);
    expect((await readBilanVersions(USERS.noah, WORKSPACE_A, ATHLETES.noah)).length).toBe(v.length);
  });

  it('temps, matériel et contraintes (D-066) : enregistrés, gardés quand rien ne change, versionnés', async () => {
    const before = (await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.noah))!;
    const { status: _s, confirmedAt: _c, sources: _src, revision: _r, updatedAt: _u, ...data } = before;
    await saveBilanByCoach(meta(USERS.marine, { athleteId: ATHLETES.noah }), { expectedRevision: before.revision, data: {
      ...data, weekdayMinutes: '60to90', preferredTime: 'evening', longDay: 7, equipment: ['home_trainer', 'power_meter'], practicalConstraints: 'Garde ses enfants le mercredi',
    } });
    const p = (await readAthleteProfile(USERS.noah, WORKSPACE_A, ATHLETES.noah))!;
    expect(p).toMatchObject({ weekdayMinutes: '60to90', preferredTime: 'evening', longDay: 7, equipment: ['home_trainer', 'power_meter'], practicalConstraints: 'Garde ses enfants le mercredi' });
    expect(p.sources.equipment).toBe('interview');
    const v = await readBilanVersions(USERS.marine, WORKSPACE_A, ATHLETES.noah);
    expect(v[0]!.changed).toEqual(expect.arrayContaining(['weekdayMinutes', 'equipment', 'practicalConstraints']));
    // L’élève renvoie son profil depuis ses réglages avec ces réponses : rien n’est effacé, pas de nouvelle version.
    const { status: _s2, confirmedAt: _c2, sources: _src2, revision: _r2, updatedAt: _u2, ...again } = p;
    await saveAthleteProfile(meta(USERS.noah), again);
    expect((await readAthleteProfile(USERS.noah, WORKSPACE_A, ATHLETES.noah))!).toMatchObject({ revision: p.revision, equipment: ['home_trainer', 'power_meter'] });
  });

  it('D-108 : autres sports et objectifs de musculation enregistrés, relus et repris dans le brouillon', async () => {
    await saveAthleteProfile(meta(USERS.noah), { ...answers, otherSports: ['strength', 'running'], strengthFocus: ['strength', 'mobility'] });
    const p = await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.noah);
    expect(p).toMatchObject({ sport: 'running', otherSports: ['strength'], strengthFocus: ['strength', 'mobility'] });
    await saveBilanDraft(meta(USERS.noah), { step: 'focus', answers: { sport: 'strength', otherSports: ['running'], strengthFocus: ['muscle'] } });
    expect((await readBilanDraft(USERS.noah, WORKSPACE_A, ATHLETES.noah))?.answers).toMatchObject({ otherSports: ['running'], strengthFocus: ['muscle'] });
  });

  it('D-109 : « L’après-midi » enregistré par la base', async () => {
    await saveAthleteProfile(meta(USERS.noah), { ...answers, preferredTime: 'afternoon' });
    expect((await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.noah))?.preferredTime).toBe('afternoon');
  });

  it('D-110 : lieux de musculation et « poids du corps » enregistrés', async () => {
    await saveAthleteProfile(meta(USERS.noah), { ...answers, otherSports: ['strength'], trainingPlaces: ['home', 'outdoor'], equipment: ['bodyweight'] });
    expect(await readAthleteProfile(USERS.marine, WORKSPACE_A, ATHLETES.noah)).toMatchObject({ trainingPlaces: ['home', 'outdoor'], equipment: ['bodyweight'] });
  });
});

