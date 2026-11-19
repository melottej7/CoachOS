import { randomUUID } from 'node:crypto';
import { todayIn, weekStart } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { openConversation, saveReceipt, saveTeamReceipt, sendMessage, sendTeamMessage, sendTeamVoice, sendVoice } from './commands/messages';
import { createTeam, setTeamMember } from './commands/portfolio';
import { createAppointment, updateAppointment } from './commands/tasks';
import { athleteInbox, coachInbox, directThread, readVoice, teamThread } from './repo/messages';
import { home } from './repo/portfolio';

// Messagerie (D-033) : droits, non-lus, suivi « répondre », fils de groupe et vocaux.

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A });
async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}
const body = (r: { body: unknown }) => r.body as { id?: string; item: { id: string; voiceId?: string | null } };
const webm = () => new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...Array.from({ length: 60 }, (_, i) => i)]);
const today = todayIn(TIME_ZONE);

beforeAll(async () => {
  setDb(await openDatabase());
});

describe('fil privé coach élève', () => {
  let cid = '';

  it('un seul fil par élève, ouvert par le coach ou par l’élève ; personne d’autre', async () => {
    cid = body(await openConversation({ ...meta(USERS.marine), athleteId: ATHLETES.camille })).id!;
    expect(body(await openConversation({ ...meta(USERS.camille), athleteId: ATHLETES.camille })).id).toBe(cid);
    expect(await codeOf(openConversation({ ...meta(USERS.noah), athleteId: ATHLETES.camille }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(openConversation({ ...meta(USERS.hugo), athleteId: ATHLETES.camille }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('message de l’élève : non lu chez le coach, suivi « répondre » ouvert puis fermé par la réponse', async () => {
    const m = await sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: '  Ma séance de demain peut-elle passer au soir ?  ' });
    expect(body(m).item).toMatchObject({ body: 'Ma séance de demain peut-elle passer au soir ?', mine: true });
    expect((await coachInbox(USERS.marine, WORKSPACE_A)).find((e) => e.id === ATHLETES.camille)?.unread).toBe(1);
    let h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.filter((t) => t.rule === 'message_reply' && t.athlete?.id === ATHLETES.camille)).toHaveLength(1);
    await saveReceipt({ ...meta(USERS.marine), conversationId: cid }, { messageId: body(m).item.id });
    expect((await coachInbox(USERS.marine, WORKSPACE_A)).find((e) => e.id === ATHLETES.camille)?.unread).toBe(0);
    await sendMessage({ ...meta(USERS.marine), conversationId: cid }, { body: 'Oui, sans problème.' });
    h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.some((t) => t.rule === 'message_reply' && t.athlete?.id === ATHLETES.camille)).toBe(false);
    const thread = await directThread(USERS.camille, WORKSPACE_A, ATHLETES.camille);
    expect(thread?.messages.map((x) => [x.mine, x.fromCoach])).toEqual([[true, false], [false, true]]);
    expect((await athleteInbox(USERS.camille, WORKSPACE_A, ATHLETES.camille))[0]?.unread).toBe(1);
  });

  it('lecture exacte à la microseconde : le dernier message lu ne reste pas « non lu »', async () => {
    const m = body(await sendMessage({ ...meta(USERS.marine), conversationId: cid }, { body: 'Horodatage fin' }));
    const db = await getDb();
    await db.query(`update public.messages set created_at = date_trunc('second', now()) + interval '1 hour 0.123456 second' where id = $1`, [m.item.id]);
    await saveReceipt({ ...meta(USERS.camille), conversationId: cid }, { messageId: m.item.id });
    expect((await athleteInbox(USERS.camille, WORKSPACE_A, ATHLETES.camille))[0]?.unread).toBe(0);
  });

  it('un tiers ne lit ni n’écrit dans le fil ; message vide refusé', async () => {
    expect(await codeOf(sendMessage({ ...meta(USERS.noah), conversationId: cid }, { body: 'coucou' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: '   ' }))).toBe('INVALID_FIELDS');
    expect((await directThread(USERS.noah, WORKSPACE_A, ATHLETES.camille))).toBeNull();
  });

  it('vocal : format reconnu, 3 minutes au plus, écoute réservée au fil', async () => {
    const v = body(await sendVoice({ ...meta(USERS.marine), conversationId: cid, seconds: 42 }, webm())).item;
    expect(v.voiceId).toBeTruthy();
    expect((await readVoice(USERS.camille, WORKSPACE_A, v.voiceId!))?.type).toBe('audio/webm');
    expect(await readVoice(USERS.noah, WORKSPACE_A, v.voiceId!)).toBeNull();
    expect(await readVoice(USERS.hugo, WORKSPACE_A, v.voiceId!)).toBeNull();
    expect(await codeOf(sendVoice({ ...meta(USERS.marine), conversationId: cid, seconds: 200 }, webm()))).toBe('INVALID_FIELDS');
    expect(await codeOf(sendVoice({ ...meta(USERS.marine), conversationId: cid, seconds: 10 }, new Uint8Array(40).fill(7)))).toBe('INVALID_FIELDS');
  });
});

describe('fil de groupe', () => {
  let tid = '';

  it('le coach et les élèves membres échangent ; noms signés ; un non-membre n’y a pas accès', async () => {
    tid = body(await createTeam(meta(USERS.marine), { name: 'Sortie du dimanche' })).id!;
    await setTeamMember({ ...meta(USERS.marine), teamId: tid, athleteId: ATHLETES.camille }, true);
    await sendTeamMessage({ ...meta(USERS.marine), teamId: tid }, { body: 'Rendez-vous dimanche 9 h au parc.' });
    expect(await codeOf(sendTeamMessage({ ...meta(USERS.noah), teamId: tid }, { body: 'Je viens !' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await teamThread(USERS.noah, WORKSPACE_A, tid)).toBeNull();
    await setTeamMember({ ...meta(USERS.marine), teamId: tid, athleteId: ATHLETES.noah }, true);
    const n = body(await sendTeamMessage({ ...meta(USERS.noah), teamId: tid }, { body: 'Je viens !' }));
    const seen = await teamThread(USERS.camille, WORKSPACE_A, tid);
    expect(seen?.messages.map((m) => m.senderName)).toEqual(['Marine Roy', 'Noah Dubois']);
    expect(seen?.members).toBeNull();
    expect((await athleteInbox(USERS.camille, WORKSPACE_A, ATHLETES.camille)).find((e) => e.id === tid)?.unread).toBe(2);
    await saveTeamReceipt({ ...meta(USERS.camille), teamId: tid }, { messageId: n.item.id });
    expect((await athleteInbox(USERS.camille, WORKSPACE_A, ATHLETES.camille)).find((e) => e.id === tid)?.unread).toBe(0);
    expect(await codeOf(sendTeamMessage({ ...meta(USERS.lea), teamId: tid }, { body: 'x' }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('message d’un élève au groupe → « Répondre au groupe » dans le Planning ; vocal de groupe', async () => {
    let h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.some((t) => t.rule === 'message_reply' && t.team?.id === tid)).toBe(true);
    const v = body(await sendTeamVoice({ ...meta(USERS.marine), teamId: tid, seconds: 15 }, webm())).item;
    expect((await readVoice(USERS.noah, WORKSPACE_A, v.voiceId!))?.type).toBe('audio/webm');
    h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.some((t) => t.rule === 'message_reply' && t.team?.id === tid)).toBe(false);
    // Retiré du groupe : plus d’accès au fil ni aux vocaux.
    await setTeamMember({ ...meta(USERS.marine), teamId: tid, athleteId: ATHLETES.noah }, false);
    expect(await teamThread(USERS.noah, WORKSPACE_A, tid)).toBeNull();
    expect(await readVoice(USERS.noah, WORKSPACE_A, v.voiceId!)).toBeNull();
  });
});

describe('rendez-vous annoncé dans la conversation (D-034)', () => {
  it('sans case cochée : rien dans le fil ; cochée : carte visible par l’élève, sans la préparation ; annulation annoncée', async () => {
    const base = { athleteId: ATHLETES.noah, title: 'Bilan du mois', kind: 'video', startsLocal: '2026-12-03T18:30', timeZone: TIME_ZONE, durationMin: 30,
      videoUrl: 'https://meet.jit.si/CoachOS-abc', prepNotes: 'Parler du seuil' };
    const silent = await createAppointment(meta(USERS.marine), base);
    expect((silent.body as { messageId: string | null }).messageId).toBeNull();
    expect((await directThread(USERS.noah, WORKSPACE_A, ATHLETES.noah))?.messages.some((m) => m.appointment)).toBe(false);

    const loud = await createAppointment(meta(USERS.marine), { ...base, notify: true });
    const item = (loud.body as { item: { id: string } }).item;
    const seen = await directThread(USERS.noah, WORKSPACE_A, ATHLETES.noah);
    const card = seen?.messages.find((m) => m.appointment)?.appointment;
    expect(card).toMatchObject({ id: item.id, title: 'Bilan du mois', kind: 'video', videoUrl: 'https://meet.jit.si/CoachOS-abc', status: 'planned', durationMin: 30 });
    expect(JSON.stringify(seen)).not.toContain('Parler du seuil');
    expect(seen?.messages.at(-1)?.body).toContain('📅 Appel vidéo prévu');
    // Un tiers ne voit ni le fil ni la carte.
    expect(await directThread(USERS.camille, WORKSPACE_A, ATHLETES.noah)).toBeNull();

    await updateAppointment({ ...meta(USERS.marine), appointmentId: item.id }, { expectedRevision: 1, status: 'canceled', notify: true });
    const after = await directThread(USERS.noah, WORKSPACE_A, ATHLETES.noah);
    expect(after?.messages.at(-1)?.body).toContain('❌ Appel vidéo annulé');
    expect(after?.messages.filter((m) => m.appointment?.id === item.id).every((m) => m.appointment?.status === 'canceled')).toBe(true);
  });
});

describe('compte à la fois coach et élève (cas de recette du fondateur)', () => {
  it('son message de coach ne crée pas « Répondre au message » et reste affiché comme venant du coach', async () => {
    const db = await getDb();
    const r = await db.query<{ id: string }>(
      `insert into public.athletes(workspace_id, display_name, time_zone, state, user_id) values ($1, 'Moi-même', $2, 'active', $3) returning id`,
      [WORKSPACE_A, TIME_ZONE, USERS.marine],
    );
    const self = r.rows[0]!.id;
    await db.query('insert into public.coach_assignments(workspace_id, athlete_id, coach_id) values ($1, $2, $3)', [WORKSPACE_A, self, USERS.marine]);
    const cid = body(await openConversation({ ...meta(USERS.marine), athleteId: self })).id!;
    await sendMessage({ ...meta(USERS.marine), conversationId: cid }, { body: 'salut' });
    const h = await home(USERS.marine, WORKSPACE_A, TIME_ZONE, weekStart(today));
    expect(h.tasks.some((t) => t.rule === 'message_reply' && t.athlete?.id === self)).toBe(false);
    expect((await directThread(USERS.marine, WORKSPACE_A, self))?.messages.at(-1)?.fromCoach).toBe(true);
  });
});

describe('message à propos d’une séance et retours dans la conversation (D-036)', () => {
  it('le message cite la séance ; le fil montre aussi les retours ; un brouillon ne peut pas être cité par l’élève', async () => {
    const cid = body(await openConversation({ ...meta(USERS.camille), athleteId: ATHLETES.camille })).id!;
    await sendMessage({ ...meta(USERS.marine), conversationId: cid }, { body: 'On en parle ?', workoutId: SEED_WORKOUTS.camilleYesterday });
    const t = await directThread(USERS.camille, WORKSPACE_A, ATHLETES.camille);
    expect(t?.messages.find((m) => m.body === 'On en parle ?')?.workout).toMatchObject({ id: SEED_WORKOUTS.camilleYesterday, title: 'Endurance fondamentale' });
    expect(Array.isArray(t?.feedbacks)).toBe(true);
    expect(await codeOf(sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: 'Et celle-ci ?', workoutId: SEED_WORKOUTS.camilleDraft }))).toBe('INVALID_FIELDS');
    expect(await codeOf(sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: 'Et celle de Noah ?', workoutId: SEED_WORKOUTS.noahToday }))).toBe('INVALID_FIELDS');
  });
});
