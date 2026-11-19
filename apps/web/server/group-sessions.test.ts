import { randomUUID } from 'node:crypto';
import { addDays, todayIn } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { createTeam, setTeamMember } from './commands/portfolio';
import { createGroupSession, publishGroupSession } from './commands/group-sessions';
import { updateWorkout } from './commands/workouts';
import { groupSession, groupSessions, teamRecipients, teamWeek } from './repo/group-sessions';
import { athleteSchedule } from './repo/athlete';

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

  it('semaine du groupe : chaque élève, l’état de chaque séance ; rien pour un autre espace (CE-G2-03)', async () => {
    const w = await teamWeek(USERS.marine, WORKSPACE_A, team, day, day);
    expect(w!.members).toHaveLength(2);
    const rows = w!.items.filter((i) => i.groupSessionId === gid);
    expect(rows.map((i) => [i.athleteId === ATHLETES.camille ? 'Camille' : 'Noah', i.status]).sort()).toEqual([['Camille', 'published'], ['Noah', 'draft']]);
    expect(await teamWeek(USERS.hugo, WORKSPACE_A, team, day, day)).toBeNull();
  });
});
