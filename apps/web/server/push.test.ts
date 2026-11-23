import { randomUUID } from 'node:crypto';
import { todayIn } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { openConversation, sendMessage } from './commands/messages';
import { markAllNotificationsRead } from './commands/notifications';
import { countMyPushDevices, deletePushSubscription, flushPushNotifications, savePushSubscription, setPushSender, type PushTarget } from './commands/push';
import { createWorkout, publishWorkouts } from './commands/workouts';

// D-118 · Rappels push : abonnement par appareil, rappel à la création d’une notification, appareil disparu oublié.

let db: Db;
const sent: { endpoint: string; payload: { title: string; body: string; url: string; tag: string } }[] = [];
const ORIGIN = 'https://coachos.test';
const OK = 'https://push.example.test/ok';
const EXPIRED = 'https://push.example.test/expired';
const meta = (actorId: string, extra: { athleteId?: string } = {}) => ({ actorId, workspaceId: WORKSPACE_A, athleteId: ATHLETES.camille, idempotencyKey: randomUUID(), requestId: randomUUID(), ...extra });
const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: 'p256dh-test', auth: 'auth-test' } });

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}
const pushState = async (userId: string, kind: string) =>
  (await db.query<{ push_state: string }>('select push_state from public.notifications where workspace_id = $1 and user_id = $2 and kind = $3 order by created_at desc limit 1', [WORKSPACE_A, userId, kind])).rows[0]?.push_state ?? null;

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  setPushSender(async (target: PushTarget, payload: string) => {
    sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload) });
    if (target.endpoint === EXPIRED) throw Object.assign(new Error('gone'), { statusCode: 410 });
  });
});

describe('abonnement (savePushSubscription, deletePushSubscription)', () => {
  it('enregistre deux appareils pour l’élève, sans doublon au rafraîchissement', async () => {
    const a = await savePushSubscription(meta(USERS.camille), sub(OK));
    expect(a.body).toMatchObject({ devices: 1 });
    const b = await savePushSubscription(meta(USERS.camille), sub(EXPIRED));
    expect(b.body).toMatchObject({ devices: 2 });
    const again = await savePushSubscription(meta(USERS.camille), { ...sub(OK), keys: { p256dh: 'p256dh-neuf', auth: 'auth-neuf' } });
    expect(again.body).toMatchObject({ devices: 2 });
    expect(await countMyPushDevices(USERS.camille, WORKSPACE_A)).toBe(2);
    expect(await countMyPushDevices(USERS.marine, WORKSPACE_A)).toBe(0);
  });

  it('refuse une personne étrangère à l’espace et une adresse non sécurisée', async () => {
    expect(await codeOf(savePushSubscription(meta(USERS.hugo), sub(OK)))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(savePushSubscription(meta(USERS.camille), sub('http://push.example.test/clair')))).toBe('INVALID_FIELDS');
    expect(await codeOf(savePushSubscription(meta(USERS.camille), { endpoint: OK }))).toBe('INVALID_FIELDS');
  });
});

describe('rappels (flushPushNotifications)', () => {
  it('une publication déclenche un rappel sans contenu ; l’appareil disparu est oublié', async () => {
    const today = todayIn(TIME_ZONE);
    const w = await createWorkout(meta(USERS.marine), { data: { localDate: today, timeZone: TIME_ZONE, sport: 'running', title: 'Fartlek 30 min', durationSeconds: 1800, instructions: 'Jouer avec le terrain.' } });
    const id = (w.body as { id: string }).id;
    await publishWorkouts(meta(USERS.marine), { changes: [{ id, revision: 1 }] });
    expect(await pushState(USERS.camille, 'workouts_published')).toBe('pending');

    sent.length = 0;
    expect(await flushPushNotifications(ORIGIN)).toBe(1);
    expect(sent.map((s) => s.endpoint).sort()).toEqual([EXPIRED, OK]);
    const payload = sent.find((s) => s.endpoint === OK)!.payload;
    expect(payload.title).toBe('CoachOS');
    expect(payload.body).toBe('Ton coach a publié une séance');
    expect(payload.url).toMatch(new RegExp(`^${ORIGIN}/n/${WORKSPACE_A}/[0-9a-f-]{36}$`));
    expect(JSON.stringify(payload)).not.toContain('Fartlek');
    expect(await pushState(USERS.camille, 'workouts_published')).toBe('sent');
    expect(await countMyPushDevices(USERS.camille, WORKSPACE_A)).toBe(1);
    // Rien à renvoyer ensuite.
    expect(await flushPushNotifications(ORIGIN)).toBe(0);
  });

  it('sans appareil abonné, aucun rappel ; avec, le coach reçoit la phrase sans le texte du message', async () => {
    const conv = await openConversation({ ...meta(USERS.marine), athleteId: ATHLETES.camille });
    const cid = (conv.body as { id: string }).id;
    await sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: 'Genou un peu raide ce matin' });
    expect(await pushState(USERS.marine, 'message')).toBe('none');

    await markAllNotificationsRead(meta(USERS.marine));
    await savePushSubscription(meta(USERS.marine), sub('https://push.example.test/coach'));
    await sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: 'Finalement ça va mieux' });
    expect(await pushState(USERS.marine, 'message')).toBe('pending');
    sent.length = 0;
    expect(await flushPushNotifications(ORIGIN)).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.payload.body).toBe('Nouveau message de Camille Laurent');
    expect(JSON.stringify(sent[0]!.payload)).not.toContain('Genou');
    expect(JSON.stringify(sent[0]!.payload)).not.toContain('mieux');
  });

  it('désabonnement : l’appareil est oublié, un inconnu ne change rien', async () => {
    expect((await deletePushSubscription(meta(USERS.camille), { endpoint: OK })).body).toEqual({ removed: true });
    expect((await deletePushSubscription(meta(USERS.camille), { endpoint: 'https://push.example.test/inconnu' })).body).toEqual({ removed: false });
    expect(await countMyPushDevices(USERS.camille, WORKSPACE_A)).toBe(0);
    expect(await codeOf(deletePushSubscription(meta(USERS.hugo), { endpoint: OK }))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
