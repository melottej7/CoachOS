import { randomUUID } from 'node:crypto';
import { addDays, todayIn } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createTeam, setTeamMember } from './commands/portfolio';
import { createGroupSession, publishGroupSession, updateGroupBase } from './commands/group-sessions';
import { updateWorkout } from './commands/workouts';
import { groupSession, groupSessions, teamRecipients, teamWeek } from './repo/group-sessions';
import { athleteSchedule } from './repo/athlete';
import { teamThread } from './repo/messages';

// Lot G2 (D-042) : base commune, brouillons par élève, adaptations conservées, exceptions, publication atomique.

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId: WORKSPACE_A });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const day = addDays(todayIn(TIME_ZONE), 3);
const workout = { sport: 'running', title: 'Piste 10 × 400 m', instructions: 'Récupération en trottinant', durationSeconds: null, distanceM: null, intervals: [] };

let team = '';
beforeAll(async () => {
  setDb(await openDatabase());
  const r = await createTeam(meta(USERS.marine), { name: 'Groupe piste' });
  team = (r.body as { id?: string; item?: { id: string } }).id ?? (r.body as { item: { id: string } }).item.id;
  await setTeamMember({ ...meta(USERS.marine), teamId: team, athleteId: ATHLETES.camille }, true);
  await setTeamMember({ ...meta(USERS.marine), teamId: team, athleteId: ATHLETES.noah }, true);
});

describe('séance de groupe', () => {
  let gid = '';
  let items: { athleteId: string; workoutId: string }[] = [];

  it('liste exacte des destinataires, puis un brouillon par élève choisi ; rien de visible côté élève', async () => {
    const rec = await teamRecipients(USERS.marine, WORKSPACE_A, team);
    expect(rec!.members.map((m) => m.id).sort()).toEqual([ATHLETES.camille, ATHLETES.noah].sort());
    const r = await createGroupSession(meta(USERS.marine), { teamId: team, localDate: day, workout, athleteIds: [ATHLETES.camille, ATHLETES.noah] });
    expect(r.status).toBe(201);
    ({ id: gid, items } = r.body as { id: string; items: typeof items });
    expect(items).toHaveLength(2);
    expect((await athleteSchedule(USERS.camille, WORKSPACE_A, ATHLETES.camille, day, day)).some((w) => w.title === workout.title)).toBe(false);
    const v = await groupSession(USERS.marine, WORKSPACE_A, gid);
    expect(v!.rows.map((x) => x.state)).toEqual(['draft', 'draft']);
    expect(v!.without).toEqual([]);
  });

  it('refuse un élève hors du groupe, un autre espace et un élève', async () => {
    expect(await codeOf(createGroupSession(meta(USERS.marine), { teamId: team, localDate: day, workout, athleteIds: [ATHLETES.ines] }))).toBe('INVALID_FIELDS');
    expect(await codeOf(createGroupSession(meta(USERS.hugo), { teamId: team, localDate: day, workout, athleteIds: [ATHLETES.camille] }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(createGroupSession(meta(USERS.camille), { teamId: team, localDate: day, workout, athleteIds: [ATHLETES.camille] }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await groupSession(USERS.camille, WORKSPACE_A, gid)).toBeNull();
  });

  it('adaptation conservée, exception non publiée, publication atomique', async () => {
    const noah = items.find((x) => x.athleteId === ATHLETES.noah)!;
    const camille = items.find((x) => x.athleteId === ATHLETES.camille)!;
    await updateWorkout({ ...meta(USERS.marine), athleteId: ATHLETES.noah, workoutId: noah.workoutId }, {
      expectedRevision: 1, data: { ...workout, title: 'Piste 8 × 400 m (adaptée)', localDate: day, timeZone: TIME_ZONE, sortOrder: 0 },
    });
    let v = await groupSession(USERS.marine, WORKSPACE_A, gid);
    expect(v!.rows.find((x) => x.athleteId === ATHLETES.noah)).toMatchObject({ state: 'adapted', title: 'Piste 8 × 400 m (adaptée)', workingRevision: 2 });

    // Révision périmée pour Noah : rien n’est publié, pas même Camille.
    expect(await codeOf(publishGroupSession({ ...meta(USERS.marine), groupSessionId: gid }, {
      items: [{ athleteId: ATHLETES.camille, workoutId: camille.workoutId, revision: 1 }, { athleteId: ATHLETES.noah, workoutId: noah.workoutId, revision: 1 }],
    }))).toBe('CONFLICT_OR_QUOTA');
    expect((await groupSession(USERS.marine, WORKSPACE_A, gid))!.rows.every((x) => x.publishedRevision === null)).toBe(true);

    // Noah en exception : seule Camille est publiée.
    const r = await publishGroupSession({ ...meta(USERS.marine), groupSessionId: gid }, { items: [{ athleteId: ATHLETES.camille, workoutId: camille.workoutId, revision: 1 }] });
    expect(r.body).toMatchObject({ published: 1 });
    expect((await athleteSchedule(USERS.camille, WORKSPACE_A, ATHLETES.camille, day, day)).some((w) => w.title === workout.title)).toBe(true);
    expect((await athleteSchedule(USERS.noah, WORKSPACE_A, ATHLETES.noah, day, day)).some((w) => w.title.startsWith('Piste'))).toBe(false);
    v = await groupSession(USERS.marine, WORKSPACE_A, gid);
    expect(v!.rows.map((x) => [x.athleteName.split(' ')[0], x.state])).toEqual([['Camille', 'published'], ['Noah', 'adapted']]);
    expect((await groupSessions(USERS.marine, WORKSPACE_A, team, day))[0]).toMatchObject({ id: gid, total: 2, published: 1 });
  });

  it('une séance d’un autre dossier ne peut pas être publiée par ce biais', async () => {
    const other = await createGroupSession(meta(USERS.marine), { teamId: team, localDate: addDays(day, 1), workout, athleteIds: [ATHLETES.camille] });
    const foreign = (other.body as { items: { workoutId: string }[] }).items[0]!.workoutId;
    expect(await codeOf(publishGroupSession({ ...meta(USERS.marine), groupSessionId: gid }, { items: [{ athleteId: ATHLETES.camille, workoutId: foreign, revision: 1 }] }))).toBe('INVALID_FIELDS');
  });

  it('modifier la base (D-046) : répercutée sur les séances qui la suivent, adaptation intacte, rien de publié', async () => {
    // Nouvelle séance de groupe : Camille et Noah suivent la base ; Noah est ensuite adapté.
    const d = addDays(day, 2);
    const c = await createGroupSession(meta(USERS.marine), { teamId: team, localDate: d, workout, athleteIds: [ATHLETES.camille, ATHLETES.noah] });
    const { id: g2, items: its } = c.body as { id: string; items: typeof items };
    const cam = its.find((x) => x.athleteId === ATHLETES.camille)!;
    const noah = its.find((x) => x.athleteId === ATHLETES.noah)!;
    await updateWorkout({ ...meta(USERS.marine), athleteId: ATHLETES.noah, workoutId: noah.workoutId }, {
      expectedRevision: 1, data: { ...workout, title: 'Piste 6 × 400 m (Noah)', localDate: d, timeZone: TIME_ZONE, sortOrder: 0 },
    });
    // Camille publiée : elle doit garder la version publiée jusqu’à la republication.
    await publishGroupSession({ ...meta(USERS.marine), groupSessionId: g2 }, { items: [{ athleteId: ATHLETES.camille, workoutId: cam.workoutId, revision: 1 }] });
    let v = (await groupSession(USERS.marine, WORKSPACE_A, g2))!;
    expect(v.revision).toBe(1);
    expect(v.rows.map((r) => [r.athleteName.split(' ')[0], r.state, r.followsBase])).toEqual([['Camille', 'published', true], ['Noah', 'adapted', false]]);

    const next = { ...workout, title: 'Piste 12 × 300 m', instructions: 'Récupération 1 min' };
    const r = await updateGroupBase({ ...meta(USERS.marine), groupSessionId: g2 }, { expectedRevision: 1, workout: next });
    expect(r.body).toMatchObject({ revision: 2, updated: [{ athleteId: ATHLETES.camille, workoutId: cam.workoutId, revision: 2 }], kept: [{ athleteId: ATHLETES.noah }] });
    v = (await groupSession(USERS.marine, WORKSPACE_A, g2))!;
    expect(v).toMatchObject({ title: 'Piste 12 × 300 m', revision: 2 });
    expect(v.rows.map((x) => [x.athleteName.split(' ')[0], x.state, x.title])).toEqual([['Camille', 'changed', 'Piste 12 × 300 m'], ['Noah', 'adapted', 'Piste 6 × 400 m (Noah)']]);
    // Camille lit toujours la version publiée (ancienne base).
    expect((await athleteSchedule(USERS.camille, WORKSPACE_A, ATHLETES.camille, d, d)).find((w) => w.id === cam.workoutId)!.title).toBe(workout.title);

    // Même base renvoyée : aucune nouvelle version.
    expect((await updateGroupBase({ ...meta(USERS.marine), groupSessionId: g2 }, { expectedRevision: 2, workout: next })).body).toEqual({ revision: 2, updated: [], kept: [] });
    expect((await groupSession(USERS.marine, WORKSPACE_A, g2))!.rows.find((x) => x.athleteId === ATHLETES.camille)!.workingRevision).toBe(2);
    // Révision de base périmée : refus ; élève et autre espace : refus.
    expect(await codeOf(updateGroupBase({ ...meta(USERS.marine), groupSessionId: g2 }, { expectedRevision: 1, workout: next }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(updateGroupBase({ ...meta(USERS.camille), groupSessionId: g2 }, { expectedRevision: 2, workout: next }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(updateGroupBase({ ...meta(USERS.hugo), groupSessionId: g2 }, { expectedRevision: 2, workout: next }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('annonce dans le fil du groupe (D-049) : envoyée avec la publication, ou rien', async () => {
    const d = addDays(day, 4);
    const c = await createGroupSession(meta(USERS.marine), { teamId: team, localDate: d, workout, athleteIds: [ATHLETES.camille, ATHLETES.noah] });
    const { id: g3, items: its } = c.body as { id: string; items: typeof items };
    const [cam, noah] = [its.find((x) => x.athleteId === ATHLETES.camille)!, its.find((x) => x.athleteId === ATHLETES.noah)!];
    const text = '📅 Nouvelle séance de groupe : « Piste », samedi. Elle t’attend dans ton Programme.';
    // Révision périmée pour Noah : ni publication ni annonce.
    expect(await codeOf(publishGroupSession({ ...meta(USERS.marine), groupSessionId: g3 }, {
      items: [{ athleteId: ATHLETES.camille, workoutId: cam.workoutId, revision: 1 }, { athleteId: ATHLETES.noah, workoutId: noah.workoutId, revision: 9 }], announce: text,
    }))).toBe('CONFLICT_OR_QUOTA');
    expect((await teamThread(USERS.camille, WORKSPACE_A, team))!.messages.some((m) => m.body === text)).toBe(false);
    const r = await publishGroupSession({ ...meta(USERS.marine), groupSessionId: g3 }, {
      items: [{ athleteId: ATHLETES.camille, workoutId: cam.workoutId, revision: 1 }, { athleteId: ATHLETES.noah, workoutId: noah.workoutId, revision: 1 }], announce: text,
    });
    expect((r.body as { announcementId: string | null }).announcementId).toBeTruthy();
    const seen = (await teamThread(USERS.noah, WORKSPACE_A, team))!.messages.filter((m) => m.body === text);
    expect(seen).toHaveLength(1);
    // Sans annonce : aucun message.
    const c2 = await createGroupSession(meta(USERS.marine), { teamId: team, localDate: addDays(d, 1), workout, athleteIds: [ATHLETES.camille] });
    const b2 = c2.body as { id: string; items: typeof items };
    const r2 = await publishGroupSession({ ...meta(USERS.marine), groupSessionId: b2.id }, { items: [{ ...b2.items[0]!, revision: 1 }] });
    expect((r2.body as { announcementId: string | null }).announcementId).toBeNull();
    expect(await codeOf(publishGroupSession({ ...meta(USERS.marine), groupSessionId: b2.id }, { items: [{ ...b2.items[0]!, revision: 1 }], announce: ' ' }))).toBe('INVALID_FIELDS');
  });

  it('semaine du groupe : chaque élève, l’état de chaque séance ; rien pour un autre espace (CE-G2-03)', async () => {
    const w = await teamWeek(USERS.marine, WORKSPACE_A, team, day, day);
    expect(w!.members).toHaveLength(2);
    const rows = w!.items.filter((i) => i.groupSessionId === gid);
    expect(rows.map((i) => [i.athleteId === ATHLETES.camille ? 'Camille' : 'Noah', i.status]).sort()).toEqual([['Camille', 'published'], ['Noah', 'draft']]);
    expect(await teamWeek(USERS.hugo, WORKSPACE_A, team, day, day)).toBeNull();
  });
});
