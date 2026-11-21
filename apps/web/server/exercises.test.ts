import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { STARTER_EXERCISES } from '@coachos/domain';
import { openDatabase, setDb } from './db/client';
import { USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { addStarterExercises, createExercise, removeExerciseClip, updateExercise, uploadExerciseClip } from './commands/exercises';
import { listExercises, readExercise, readExerciseClip } from './repo/exercises';

// D-096 : bibliothèque d’exercices de musculation, vidéos privées à l’espace.

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
/** En-tête MP4 minimal (boîte « ftyp ») suivi d’octets quelconques. */
const mp4 = () => Uint8Array.from([0, 0, 0, 24, ...Buffer.from('ftypisom'), 0, 0, 2, 0, ...Buffer.from('isomiso2mp41'), ...new Array(200).fill(7)]);

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('exercices de musculation (D-096)', () => {
  it('le coach crée et modifie ; ses élèves lisent ; un autre espace ne voit rien ; un élève n’écrit pas', async () => {
    const r = await createExercise(meta(USERS.marine), { name: ' Squat sauté ', muscle: 'legs', equipment: ['bodyweight', 'bodyweight'], instructions: 'Amortis la réception.', videoUrl: 'https://youtu.be/abcdefghijk' });
    expect(r.status).toBe(201);
    const { id } = r.body as { id: string };
    const ex = await readExercise(USERS.camille, WORKSPACE_A, id);
    expect(ex).toMatchObject({ name: 'Squat sauté', muscle: 'legs', equipment: ['bodyweight'], videoUrl: 'https://youtu.be/abcdefghijk', clipId: null });
    expect(await readExercise(USERS.hugo, WORKSPACE_A, id)).toBeNull();
    expect(await readExercise(USERS.lea, WORKSPACE_A, id)).toBeNull();
    expect(await codeOf(createExercise(meta(USERS.camille), { name: 'Pompes' }))).toBe('RESOURCE_NOT_VISIBLE');
    // Nom unique (sans tenir compte des majuscules), lien en https seulement.
    expect(await codeOf(createExercise(meta(USERS.marine), { name: 'squat SAUTÉ' }))).toBe('INVALID_FIELDS');
    expect(await codeOf(createExercise(meta(USERS.marine), { name: 'Gainage', videoUrl: 'http://exemple.org/v' }))).toBe('INVALID_FIELDS');
    // Révision attendue, puis retrait : le nom redevient libre.
    expect(await codeOf(updateExercise({ ...meta(USERS.marine), exerciseId: id }, { name: 'Squat sauté', expectedRevision: 7 }))).toBe('CONFLICT_OR_QUOTA');
    await updateExercise({ ...meta(USERS.marine), exerciseId: id }, { name: 'Squat sauté', muscle: 'legs', expectedRevision: 1, archive: true });
    expect((await listExercises(USERS.marine, WORKSPACE_A)).some((e) => e.id === id)).toBe(false);
    expect((await createExercise(meta(USERS.marine), { name: 'Squat sauté' })).status).toBe(201);
  });

  it('exercices de départ ajoutés une fois, sans doublon de nom', async () => {
    await createExercise(meta(USERS.marine), { name: 'POMPES' });
    const first = (await addStarterExercises(meta(USERS.marine))).body as { added: number; skipped: number };
    expect(first).toEqual({ added: STARTER_EXERCISES.length - 1, skipped: 1 });
    expect((await addStarterExercises(meta(USERS.marine))).body).toEqual({ added: 0, skipped: STARTER_EXERCISES.length });
    const list = await listExercises(USERS.camille, WORKSPACE_A);
    expect(list.filter((e) => e.starter)).toHaveLength(STARTER_EXERCISES.length - 1);
    // D-099 : chaque exercice de départ garde sa clé, même renommé ; le coach peut refuser la vidéo de base.
    const goblet = list.find((e) => e.name === 'Squat goblet')!;
    expect(goblet).toMatchObject({ starterKey: 'squat-goblet', useBaseVideo: true });
    await updateExercise({ ...meta(USERS.marine), exerciseId: goblet.id }, { name: 'Goblet squat (mon nom)', muscle: 'legs', expectedRevision: goblet.revision, useBaseVideo: false });
    expect(await readExercise(USERS.camille, WORKSPACE_A, goblet.id)).toMatchObject({ name: 'Goblet squat (mon nom)', starterKey: 'squat-goblet', useBaseVideo: false });
    expect(await codeOf(addStarterExercises(meta(USERS.camille)))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('vidéo filmée : reconnue par son contenu, lue par l’élève de l’espace, remplacée puis retirée', async () => {
    const { id } = (await createExercise(meta(USERS.marine), { name: 'Rowing élastique maison' })).body as { id: string };
    const up = { actorId: USERS.marine, requestId: randomUUID(), workspaceId: WORKSPACE_A, exerciseId: id };
    expect(await codeOf(uploadExerciseClip(up, Uint8Array.from(Buffer.from('<html>pas une vidéo</html>'))))).toBe('INVALID_FIELDS');
    expect(await codeOf(uploadExerciseClip({ ...up, actorId: USERS.camille }, mp4()))).toBe('RESOURCE_NOT_VISIBLE');
    const first = (await uploadExerciseClip(up, mp4())).body as { clipId: string };
    const clip = await readExerciseClip(USERS.camille, WORKSPACE_A, id);
    expect(clip?.type).toBe('video/mp4');
    expect(clip?.bytes.length).toBe(mp4().length);
    expect(await readExerciseClip(USERS.lea, WORKSPACE_A, id)).toBeNull();
    const second = (await uploadExerciseClip({ ...up, requestId: randomUUID() }, mp4())).body as { clipId: string };
    expect(second.clipId).not.toBe(first.clipId);
    const rev = (await readExercise(USERS.marine, WORKSPACE_A, id))!.revision;
    expect(rev).toBe(3);
    await removeExerciseClip({ ...meta(USERS.marine), exerciseId: id });
    expect(await readExerciseClip(USERS.camille, WORKSPACE_A, id)).toBeNull();
  });
});
