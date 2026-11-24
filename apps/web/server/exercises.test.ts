import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { STARTER_EXERCISES } from '@coachos/domain';
import { openDatabase, setDb } from './db/client';
import { USERS, WORKSPACE_A, WORKSPACE_B } from './db/fixtures';
import { AppError } from './errors';
import { addStarterExercises, createExercise, finishExerciseClipUpload, removeExerciseClip, startExerciseClipUpload, updateExercise, uploadExerciseClip } from './commands/exercises';
import { listExercises, readExercise, readExerciseClip } from './repo/exercises';
import { setVideoStore, type VideoStore } from './storage/video-store';

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
    expect(clip?.bytes?.length).toBe(mp4().length);
    expect(await readExerciseClip(USERS.lea, WORKSPACE_A, id)).toBeNull();
    const second = (await uploadExerciseClip({ ...up, requestId: randomUUID() }, mp4())).body as { clipId: string };
    expect(second.clipId).not.toBe(first.clipId);
    const rev = (await readExercise(USERS.marine, WORKSPACE_A, id))!.revision;
    expect(rev).toBe(3);
    await removeExerciseClip({ ...meta(USERS.marine), exerciseId: id });
    expect(await readExerciseClip(USERS.camille, WORKSPACE_A, id)).toBeNull();
  });
});

/** Faux stockage en mémoire : ce que le téléphone a envoyé, et ce qui a été retiré. */
function memoryStore() {
  const files = new Map<string, Uint8Array>();
  const removed: string[] = [];
  const store: VideoStore = {
    uploadUrl: async (path) => `https://stockage.test/envoi/${path}?jeton=1`,
    head: async (path) => { const f = files.get(path); return f ? { size: f.length, head: f.slice(0, 4096) } : null; },
    readUrl: async (path, seconds) => `https://stockage.test/lecture/${path}?s=${seconds}`,
    remove: async (paths) => { for (const x of paths) { files.delete(x); removed.push(x); } },
  };
  return { store, files, removed };
}

describe('vidéo envoyée directement au stockage (D-173)', () => {
  it('lien d’envoi au seul coach, vidéo vérifiée puis rattachée, remplacée, retirée ; fichiers refusés supprimés', async () => {
    const { store, files, removed } = memoryStore();
    setVideoStore(store);
    try {
      const { id } = (await createExercise(meta(USERS.marine), { name: 'Fentes filmées' })).body as { id: string };
      const m = (actorId: string, workspaceId = WORKSPACE_A) => ({ ...meta(actorId), workspaceId, exerciseId: id });
      const want = { contentType: 'video/quicktime', size: 30 * 1024 * 1024 };
      // Droits : ni l’élève, ni le coach d’un autre espace ; taille et type bornés.
      expect(await codeOf(startExerciseClipUpload(m(USERS.camille), want))).toBe('RESOURCE_NOT_VISIBLE');
      expect(await codeOf(startExerciseClipUpload(m(USERS.hugo), want))).toBe('RESOURCE_NOT_VISIBLE');
      expect(await codeOf(startExerciseClipUpload(m(USERS.hugo, WORKSPACE_B), want))).toBe('RESOURCE_NOT_VISIBLE');
      expect(await codeOf(startExerciseClipUpload(m(USERS.marine), { ...want, size: 51 * 1024 * 1024 }))).toBe('INVALID_FIELDS');
      expect(await codeOf(startExerciseClipUpload(m(USERS.marine), { ...want, contentType: 'text/html' }))).toBe('INVALID_FIELDS');

      const start = async () => (await startExerciseClipUpload(m(USERS.marine), want)).body as { mode: string; clipId: string; uploadUrl: string };
      const a = await start();
      expect(a.mode).toBe('direct');
      expect(a.uploadUrl).toContain(`${WORKSPACE_A}/${a.clipId}`);
      // Rien d’envoyé, puis un faux fichier : refusés, le faux est supprimé du stockage.
      expect(await codeOf(finishExerciseClipUpload(m(USERS.marine), { clipId: a.clipId }))).toBe('INVALID_FIELDS');
      files.set(`${WORKSPACE_A}/${a.clipId}`, Uint8Array.from(Buffer.from('<html>pas une vidéo</html>')));
      expect(await codeOf(finishExerciseClipUpload(m(USERS.marine), { clipId: a.clipId }))).toBe('INVALID_FIELDS');
      expect(removed).toContain(`${WORKSPACE_A}/${a.clipId}`);

      // Une vraie vidéo : rattachée ; l’élève de l’espace la lit par le stockage, pas un autre espace ; l’élève ne la rattache pas.
      const b = await start();
      files.set(`${WORKSPACE_A}/${b.clipId}`, mp4());
      expect(await codeOf(finishExerciseClipUpload(m(USERS.camille), { clipId: b.clipId }))).toBe('RESOURCE_NOT_VISIBLE');
      const key = randomUUID();
      const done = await finishExerciseClipUpload({ ...m(USERS.marine), idempotencyKey: key }, { clipId: b.clipId });
      expect(done.body).toMatchObject({ id, clipId: b.clipId, revision: 2 });
      expect(await readExerciseClip(USERS.camille, WORKSPACE_A, id)).toEqual({ type: 'video/mp4', path: `${WORKSPACE_A}/${b.clipId}` });
      expect(await readExerciseClip(USERS.lea, WORKSPACE_B, id)).toBeNull();
      // Rejouée (même clé ou nouvelle) : même résultat, pas de doublon.
      expect((await finishExerciseClipUpload({ ...m(USERS.marine), idempotencyKey: key }, { clipId: b.clipId })).body).toEqual(done.body);
      expect((await finishExerciseClipUpload(m(USERS.marine), { clipId: b.clipId })).body).toMatchObject({ clipId: b.clipId, revision: 2 });

      // Remplacée : l’ancienne quitte le stockage ; retirée : la nouvelle aussi.
      const c = await start();
      files.set(`${WORKSPACE_A}/${c.clipId}`, mp4());
      await finishExerciseClipUpload(m(USERS.marine), { clipId: c.clipId });
      expect(removed).toContain(`${WORKSPACE_A}/${b.clipId}`);
      expect(files.has(`${WORKSPACE_A}/${b.clipId}`)).toBe(false);
      await removeExerciseClip({ ...meta(USERS.marine), exerciseId: id });
      expect(files.has(`${WORKSPACE_A}/${c.clipId}`)).toBe(false);
      expect(await readExerciseClip(USERS.camille, WORKSPACE_A, id)).toBeNull();

      // Stockage injoignable : repli sur l’envoi par CoachOS, sans erreur pour le coach.
      setVideoStore({ ...store, uploadUrl: async () => { throw new Error('storage_down'); } });
      expect((await startExerciseClipUpload(m(USERS.marine), want)).body).toEqual({ mode: 'server' });
      // Sans stockage (démonstration) : l’envoi passe par CoachOS, comme avant.
      setVideoStore(null);
      expect((await startExerciseClipUpload(m(USERS.marine), want)).body).toEqual({ mode: 'server' });
      expect(await codeOf(finishExerciseClipUpload(m(USERS.marine), { clipId: c.clipId }))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
    } finally {
      setVideoStore(undefined);
    }
  });
});
