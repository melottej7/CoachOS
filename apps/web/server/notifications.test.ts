import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, readAs, setDb, systemTx } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { setMailer, type EmailMessage } from './email/send';
import { openConversation, sendMessage, sendTeamMessage } from './commands/messages';
import { createTeam, setTeamMember } from './commands/portfolio';
import { publishWorkouts } from './commands/workouts';
import { saveFeedback } from './commands/feedback';
import { addFouleeLibrary } from './commands/library';
import {
  flushNotificationEmails, listNotifications, markAllNotificationsRead, markNotificationRead, resolveNotification, saveNotificationSettings, unreadNotificationCount,
} from './commands/notifications';
import { listLibrary } from './repo/library';

// D-067 : notifications (centre, regroupement, e-mails sans contenu, réglage, liens revérifiés) ; D-068 : import Foulée.

const meta = <E extends object = object>(actorId: string, extra: E = {} as E) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A, ...extra });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const mails: EmailMessage[] = [];
const emailState = async (id: string) => (await systemTx((tx) => tx.query<{ email_state: string }>('select email_state from public.notifications where id = $1', [id]))).rows[0]!.email_state;

beforeAll(async () => { setDb(await openDatabase()); setMailer(async (m) => void mails.push(m)); });
afterAll(() => setMailer(undefined));

describe('notifications (D-067)', () => {
  let cid = '';
  it('publication : l’élève est prévenu, une seule notification regroupée, un seul e-mail sans contenu', async () => {
    const draft = (await readAs(USERS.marine, (tx) => tx.query<{ working_revision: number }>('select working_revision from public.workouts where id = $1', [SEED_WORKOUTS.camilleDraft]))).rows[0]!;
    await publishWorkouts(meta(USERS.marine, { athleteId: ATHLETES.camille }), { changes: [{ id: SEED_WORKOUTS.camilleDraft, revision: draft.working_revision }] });
    let list = await listNotifications(USERS.camille, WORKSPACE_A);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'workouts_published', text: 'Ton coach a publié une séance', read: false });
    expect(await listNotifications(USERS.marine, WORKSPACE_A)).toEqual([]); // jamais l’auteur
    expect(await flushNotificationEmails('http://localhost:3000')).toBe(1);
    expect(mails.at(-1)!.subject).toMatch(/Ton coach a publié une séance/);
    expect(mails.at(-1)!.text).toMatch(new RegExp(`/n/${WORKSPACE_A}/${list[0]!.id}`));
    // Republier la même version ne publie rien de nouveau : pas de nouvelle notification.
    await publishWorkouts(meta(USERS.marine, { athleteId: ATHLETES.camille }), { changes: [{ id: SEED_WORKOUTS.camilleDraft, revision: draft.working_revision }] });
    list = await listNotifications(USERS.camille, WORKSPACE_A);
    expect(list).toHaveLength(1);
  });

  it('messages : l’autre partie est prévenue, sans le texte ; regroupés tant que non lus ; e-mail au plus un par fenêtre', async () => {
    cid = (await openConversation({ ...meta(USERS.camille), athleteId: ATHLETES.camille })).body as never;
    cid = (cid as unknown as { id: string }).id;
    await sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: 'Message très personnel' });
    await sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: 'Et un deuxième' });
    const coach = await listNotifications(USERS.marine, WORKSPACE_A);
    expect(coach).toHaveLength(1);
    expect(coach[0]).toMatchObject({ kind: 'message', text: 'Nouveau message de Camille Laurent', count: 2 });
    await flushNotificationEmails('http://localhost:3000');
    expect(mails.some((m) => m.text.includes('Message très personnel') || m.subject.includes('personnel'))).toBe(false);
    // Lue, puis un nouveau message dans la fenêtre de 3 heures : nouvelle notification, pas de nouvel e-mail.
    await markAllNotificationsRead(meta(USERS.marine));
    expect(await unreadNotificationCount(USERS.marine, WORKSPACE_A)).toBe(0);
    await sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: 'Troisième' });
    const again = (await listNotifications(USERS.marine, WORKSPACE_A))[0]!;
    expect(again.read).toBe(false);
    expect(await emailState(again.id)).toBe('skipped');
  });

  it('réglage « aucun e-mail » ; retour reçu par le coach ; lien revérifié au clic ; accès d’un autre refusé', async () => {
    expect(await codeOf(saveNotificationSettings(meta(USERS.camille), { email: 'parfois' }))).toBe('INVALID_FIELDS');
    await saveNotificationSettings(meta(USERS.camille), { email: 'none' });
    await sendMessage({ ...meta(USERS.marine), conversationId: cid }, { body: 'Réponse du coach' });
    const msg = (await listNotifications(USERS.camille, WORKSPACE_A)).find((n) => n.kind === 'message')!;
    expect(msg.text).toBe('Nouveau message de ton coach');
    expect(await emailState(msg.id)).toBe('none');
    expect(await resolveNotification(USERS.camille, WORKSPACE_A, msg.id)).toEqual({ href: `/athlete/${WORKSPACE_A}/messages/coach` });
    expect((await listNotifications(USERS.camille, WORKSPACE_A)).find((n) => n.id === msg.id)!.read).toBe(true);
    // Autre utilisateur : la notification n’existe pas pour lui.
    expect(await resolveNotification(USERS.noah, WORKSPACE_A, msg.id)).toBeNull();
    expect(await codeOf(markNotificationRead(meta(USERS.noah, { notificationId: msg.id })))).toBe('RESOURCE_NOT_VISIBLE');
    // Retour de séance : le coach est prévenu et le lien ouvre le retour à traiter.
    await saveFeedback(meta(USERS.camille, { athleteId: ATHLETES.camille, workoutId: SEED_WORKOUTS.camilleToday }), { publishedRevision: 1, state: 'completed', durationSeconds: 2100 });
    const fb = (await listNotifications(USERS.marine, WORKSPACE_A)).find((n) => n.kind === 'feedback')!;
    expect(fb.text).toBe('Camille Laurent a envoyé un retour de séance');
    expect((await resolveNotification(USERS.marine, WORKSPACE_A, fb.id))!.href).toMatch(new RegExp(`^/coach/${WORKSPACE_A}/review/`));
  });
});

describe('fils de groupe (D-076)', () => {
  it('membres et coachs prévenus, sauf l’auteur ; regroupés ; sans e-mail ; lien vers le fil ; non-membre exclu', async () => {
    const tid = ((await createTeam(meta(USERS.marine), { name: 'Sortie du dimanche' })).body as { id: string }).id;
    await setTeamMember(meta(USERS.marine, { teamId: tid, athleteId: ATHLETES.camille }), true);
    await sendTeamMessage(meta(USERS.marine, { teamId: tid }), { body: 'Rendez-vous dimanche 9 h' });
    await sendTeamMessage(meta(USERS.marine, { teamId: tid }), { body: 'Prévoyez de l’eau' });
    const g = (await listNotifications(USERS.camille, WORKSPACE_A)).find((n) => n.kind === 'group_message')!;
    expect(g.text).toBe('2 nouveaux messages dans le groupe « Sortie du dimanche »');
    expect(await emailState(g.id)).toBe('none');
    expect((await listNotifications(USERS.marine, WORKSPACE_A)).some((n) => n.kind === 'group_message')).toBe(false); // l’auteur
    expect((await listNotifications(USERS.noah, WORKSPACE_A)).some((n) => n.kind === 'group_message')).toBe(false); // pas membre
    expect(await resolveNotification(USERS.camille, WORKSPACE_A, g.id)).toEqual({ href: `/athlete/${WORKSPACE_A}/messages/groupe/${tid}` });
    // Camille répond : le coach est prévenu, lien vers le fil côté coach.
    await sendTeamMessage(meta(USERS.camille, { teamId: tid }), { body: 'Je serai là' });
    const c = (await listNotifications(USERS.marine, WORKSPACE_A)).find((n) => n.kind === 'group_message')!;
    expect(c.text).toBe('Nouveau message dans le groupe « Sortie du dimanche »');
    expect(await resolveNotification(USERS.marine, WORKSPACE_A, c.id)).toEqual({ href: `/coach/${WORKSPACE_A}/messages/groupe/${tid}` });
  });
});

describe('bibliothèque Foulée (D-068)', () => {
  it('324 séances ajoutées une fois ; rejouer n’ajoute rien ; réservé au coach', async () => {
    const r = await addFouleeLibrary(meta(USERS.marine));
    expect(r.body).toMatchObject({ added: 324 });
    expect((await addFouleeLibrary(meta(USERS.marine))).body).toEqual({ added: 0, skipped: 324 });
    let lib = await listLibrary(USERS.marine, WORKSPACE_A);
    const foulee = lib.filter((i) => i.meta?.source === 'foulee');
    expect(foulee).toHaveLength(324);
    expect(foulee.every((i) => i.workout.instructions === null)).toBe(true); // rien que l’élève lirait (D-077)
    expect(foulee.filter((i) => i.meta?.calculated)).toHaveLength(168);
    expect(await codeOf(addFouleeLibrary(meta(USERS.camille)))).not.toBe('OK');
    // Séance importée à l’ancienne (note dans les consignes, sans repères) : rejouer l’import la corrige.
    const old = foulee[0]!;
    await systemTx((tx) => tx.query(`update public.templates set payload = jsonb_set(payload - 'meta', '{workout,instructions}', '"Bibliothèque Foulée · famille « x » · palier 1 sur 2."'::jsonb) where id = $1`, [old.id]));
    await addFouleeLibrary(meta(USERS.marine));
    lib = await listLibrary(USERS.marine, WORKSPACE_A);
    expect(lib.find((i) => i.id === old.id)).toMatchObject({ meta: { source: 'foulee' }, workout: { instructions: null } });
  });
});
