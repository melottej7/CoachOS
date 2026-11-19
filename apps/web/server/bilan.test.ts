import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { confirmBilan, readAthleteProfile, readBilanDraft, saveAthleteProfile, saveBilanByCoach, saveBilanDraft } from './commands/athlete-profile';

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
});

