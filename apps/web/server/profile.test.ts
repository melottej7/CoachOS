import { randomUUID } from 'node:crypto';
import { addDays, todayIn } from '@coachos/domain';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { ATHLETES, TIME_ZONE, USERS, WORKSPACE_A, WORKSPACE_B } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { setMailer } from './email/send';
import { AppError } from './errors';
import { acceptInvitation, createAthlete, issueInvitation } from './commands/invitations';
import { readMe, updateAthleteSettings, updateMe } from './commands/profile';
import { athleteSchedule, athleteWorkout } from './repo/athlete';
import { coachWeek, listAssignedAthletes } from './repo/coach';
import { athleteContext, listWorkspaces } from './repo/context';

let db: Db;
let lastMail = '';
const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID() });
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
  db = await openDatabase();
  setDb(db);
  setMailer(async (m) => void (lastMail = m.text));
});

describe('profil (C02-07) et réglage athlète (X07)', () => {
  it('le nom change sans toucher au rôle ; champs vides ou inconnus refusés', async () => {
    const r = await updateMe(meta(USERS.marine), { displayName: '  Marine R. ' });
    expect(r.body).toEqual({ displayName: 'Marine R.', locale: 'fr' });
    expect((await readMe(USERS.marine))?.displayName).toBe('Marine R.');
    const roles = await db.query<{ role: string }>('select role from public.memberships where user_id = $1', [USERS.marine]);
    expect(roles.rows.map((x) => x.role)).toEqual(['owner']);
    expect(await codeOf(updateMe(meta(USERS.marine), {}))).toBe('INVALID_FIELDS');
    expect(await codeOf(updateMe(meta(USERS.marine), { locale: 'de' }))).toBe('INVALID_FIELDS');
    expect(await codeOf(updateMe(meta(USERS.marine), { displayName: 'x', role: 'owner' }))).toBe('INVALID_FIELDS');
  });

  it('l’athlète change son fuseau sans redater ses séances ; personne d’autre ne peut', async () => {
    const before = await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, SEED_WORKOUTS.camilleToday);
    await updateAthleteSettings({ ...meta(USERS.camille), workspaceId: WORKSPACE_A }, { timeZone: 'America/Montreal' });
    expect((await athleteContext(USERS.camille, WORKSPACE_A))?.athlete.timeZone).toBe('America/Montreal');
    const after = await athleteWorkout(USERS.camille, WORKSPACE_A, ATHLETES.camille, SEED_WORKOUTS.camilleToday);
    expect(after?.workout.localDate).toBe(before?.workout.localDate);
    expect(await codeOf(updateAthleteSettings({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { timeZone: 'UTC' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(updateAthleteSettings({ ...meta(USERS.lea), workspaceId: WORKSPACE_A }, { timeZone: 'UTC' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(updateAthleteSettings({ ...meta(USERS.camille), workspaceId: WORKSPACE_A }, { timeZone: 'Nowhere/City' }))).toBe('INVALID_FIELDS');
  });
});

describe('un athlète dans deux espaces (C03-10)', () => {
  let leaInA = '';

  it('Léa, athlète de l’espace B, rejoint aussi l’espace A', async () => {
    const a = await createAthlete({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { displayName: 'Léa Moreau', timeZone: TIME_ZONE });
    leaInA = (a.body as { id: string }).id;
    await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: leaInA, appOrigin: 'http://localhost:3000' }, { email: 'lea.moreau@demo.coachos.test' });
    const token = /#token=([A-Za-z0-9_-]+)/.exec(lastMail)![1]!;
    await acceptInvitation(meta(USERS.lea), { token });
    const spaces = await listWorkspaces(USERS.lea);
    expect(spaces.map((s) => [s.id, s.role, s.athleteId]).sort()).toEqual(
      [[WORKSPACE_A, 'athlete', leaInA], [WORKSPACE_B, 'athlete', ATHLETES.lea]].sort(),
    );
  });

  it('deux contextes indépendants : chaque espace ne montre que ses propres séances', async () => {
    const today = todayIn(TIME_ZONE);
    const range = [addDays(today, -7), addDays(today, 7)] as const;
    expect(await athleteSchedule(USERS.lea, WORKSPACE_A, leaInA, ...range)).toEqual([]);
    const inB = await athleteSchedule(USERS.lea, WORKSPACE_B, ATHLETES.lea, ...range);
    expect(inB.map((w) => w.id)).toEqual([SEED_WORKOUTS.leaToday]);
    // Mélanger l’espace d’un dossier et l’identifiant de l’autre ne donne rien.
    expect(await athleteSchedule(USERS.lea, WORKSPACE_A, ATHLETES.lea, ...range)).toEqual([]);
    expect(await athleteWorkout(USERS.lea, WORKSPACE_A, ATHLETES.lea, SEED_WORKOUTS.leaToday)).toBeNull();
  });

  it('chaque coach ne voit que le dossier de son espace', async () => {
    expect((await listAssignedAthletes(USERS.marine, WORKSPACE_A)).some((a) => a.id === leaInA)).toBe(true);
    expect(await listAssignedAthletes(USERS.marine, WORKSPACE_B)).toEqual([]);
    expect(await coachWeek(USERS.marine, WORKSPACE_B, ATHLETES.lea, addDays(todayIn(TIME_ZONE), -7), addDays(todayIn(TIME_ZONE), 7))).toEqual([]);
    expect((await listAssignedAthletes(USERS.hugo, WORKSPACE_B)).map((a) => a.id)).toEqual([ATHLETES.lea]);
    expect(await listAssignedAthletes(USERS.hugo, WORKSPACE_A)).toEqual([]);
  });
});
