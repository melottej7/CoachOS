import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { acceptInvitation, importRoster, type ImportedAthlete } from './commands/invitations';
import { listAssignedAthletes } from './repo/coach';

// D-169 : ajouter plusieurs élèves d’un coup. Base PGlite en mémoire, données fictives.

let db: Db;
const ORIGIN = 'http://localhost:3000';
const SAM = randomUUID(); // futur élève, accepte son lien
const ASSIST = randomUUID(); // coach non propriétaire de l’espace A
const meta = (actorId: string, key = randomUUID()) => ({ actorId, idempotencyKey: key, requestId: randomUUID(), workspaceId: WORKSPACE_A, appOrigin: ORIGIN });
async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}
const body = {
  timeZone: 'Europe/Paris',
  rows: [
    { displayName: 'Sam Leroy', email: 'sam@demo.coachos.test', group: 'Trail long' },
    { displayName: 'Jade Roux', email: null, group: 'trail LONG' },
    { displayName: 'Yann Colin', group: 'Débutants' },
    { displayName: 'Iris Noël' },
  ],
};

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  for (const [id, email, name] of [[SAM, 'sam@demo.coachos.test', 'Sam'], [ASSIST, 'assist@demo.coachos.test', 'Assistante']]) {
    await db.query('insert into auth.users(id, email) values ($1, $2)', [id, email]);
    await db.query('insert into public.users(id, display_name) values ($1, $2)', [id, name]);
  }
  await db.query(`insert into public.memberships(workspace_id, user_id, role) values ($1, $2, 'coach')`, [WORKSPACE_A, ASSIST]);
});

describe('ajouter plusieurs élèves (D-169)', () => {
  let items: ImportedAthlete[] = [];

  it('crée les fiches, les groupes (sans doublon de casse) et un lien par adresse ; même clé, mêmes fiches', async () => {
    const before = (await listAssignedAthletes(USERS.marine, WORKSPACE_A)).length;
    const key = randomUUID();
    const a = await importRoster(meta(USERS.marine, key), body);
    const b = await importRoster(meta(USERS.marine, key), body);
    expect(b).toEqual(a);
    expect(a.status).toBe(201);
    const out = a.body as { items: ImportedAthlete[]; teamsCreated: number };
    items = out.items;
    expect(out.teamsCreated).toBe(2);
    expect(items.map((i) => [i.displayName, Boolean(i.link)])).toEqual([['Sam Leroy', true], ['Jade Roux', false], ['Yann Colin', false], ['Iris Noël', false]]);
    expect(items[0]!.link).toMatch(/^http:\/\/localhost:3000\/invite#token=/);
    expect((await listAssignedAthletes(USERS.marine, WORKSPACE_A)).length).toBe(before + 4);
    const members = await db.query<{ name: string; n: number }>(
      `select t.name, count(*)::int as n from public.team_athletes ta join public.teams t on t.id = ta.team_id
       where ta.workspace_id = $1 and t.name in ('Trail long', 'Débutants') group by t.name order by t.name`,
      [WORKSPACE_A],
    );
    expect(members.rows).toEqual([{ name: 'Débutants', n: 1 }, { name: 'Trail long', n: 2 }]);
  });

  it('le lien ne garde pas le jeton en base et fait rejoindre l’élève avec son adresse', async () => {
    const stored = await db.query<{ n: number; t: number }>(
      `select count(*)::int as n, count(*) filter (where response::text like '%token=%')::int as t from public.operation_keys where action = 'athlete.import'`,
    );
    expect(stored.rows[0]).toEqual({ n: 1, t: 0 });
    const token = /#token=(.+)$/.exec(items[0]!.link!)![1]!;
    expect(await codeOf(acceptInvitation({ actorId: SAM, idempotencyKey: randomUUID(), requestId: randomUUID() }, { token }))).toBe('OK');
    const state = await db.query<{ state: string }>('select state from public.athletes where id = $1', [items[0]!.athleteId]);
    expect(state.rows[0]!.state).toBe('active');
  });

  it('un groupe existant est réutilisé, pas recréé', async () => {
    const r = await importRoster(meta(USERS.marine), { timeZone: 'Europe/Paris', rows: [{ displayName: 'Noa Faure', group: 'débutants' }] });
    expect((r.body as { teamsCreated: number }).teamsCreated).toBe(0);
  });

  it('droits : seul le propriétaire de l’espace ajoute des élèves', async () => {
    expect(await codeOf(importRoster(meta(ASSIST), body))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
    expect(await codeOf(importRoster(meta(USERS.hugo), body))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(importRoster(meta(USERS.camille), body))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('refuse une liste invalide par erreur de champ, sans rien créer', async () => {
    const n = (await db.query<{ n: number }>('select count(*)::int as n from public.athletes where workspace_id = $1', [WORKSPACE_A])).rows[0]!.n;
    expect(await codeOf(importRoster(meta(USERS.marine), { timeZone: 'Europe/Paris', rows: [{ displayName: 'Ok' }, { displayName: 'X', email: 'faux' }] }))).toBe('INVALID_FIELDS');
    expect((await db.query<{ n: number }>('select count(*)::int as n from public.athletes where workspace_id = $1', [WORKSPACE_A])).rows[0]!.n).toBe(n);
  });
});
