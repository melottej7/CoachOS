import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { ATHLETES, USERS, WORKSPACE_A, WORKSPACE_B } from './db/fixtures';
import { SEED_WORKOUTS } from './db/seed';
import { AppError } from './errors';
import { openConversation, sendMessage } from './commands/messages';
import {
  eraseAthleteData, exportMyData, listMyPrivacyRequests, openPrivacyRequest, pendingErasure, readNotice, readPrivacyRequest,
} from './commands/privacy';

// D-115 · Données personnelles : notice, export sous RLS, demandes à 30 jours, effacement complet par le propriétaire.

let db: Db;
const deleted: string[] = [];
const fakeDeleteAuth = async (id: string) => { deleted.push(id); };
const meta = (actorId: string, workspaceId = WORKSPACE_A) => ({ actorId, workspaceId, idempotencyKey: randomUUID(), requestId: randomUUID() });

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}

/** Tables du dossier d’un élève (workspace_id + athlete_id) d’après le catalogue : la liste de suppression doit toutes les vider. */
async function athleteTables(): Promise<string[]> {
  const r = await db.query<{ table_name: string }>(
    `select c.table_name from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'athlete_id'
       and exists (select 1 from information_schema.columns w where w.table_schema = 'public' and w.table_name = c.table_name and w.column_name = 'workspace_id')
       and exists (select 1 from information_schema.tables t where t.table_schema = 'public' and t.table_name = c.table_name and t.table_type = 'BASE TABLE')
     order by 1`,
  );
  return r.rows.map((x) => x.table_name);
}

async function personTables(): Promise<{ table: string; column: string }[]> {
  const r = await db.query<{ table_name: string; column_name: string }>(
    `select c.table_name, c.column_name from information_schema.columns c
     join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name in ('user_id', 'sender_id', 'actor_id', 'owner_id', 'author_id', 'coach_id', 'assignee_id', 'requester_id')
     order by 1, 2`,
  );
  return r.rows.map((x) => ({ table: x.table_name, column: x.column_name }));
}

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
});

describe('notice (readNotice)', () => {
  it('est lisible par un élève et par un coach de l’espace, pas par un autre coach', async () => {
    const camille = await readNotice(USERS.camille, WORKSPACE_A);
    expect(camille?.version).toBeTruthy();
    expect(camille!.body.length).toBeGreaterThan(50);
    expect(camille!.body.length).toBeLessThanOrEqual(2000);
    expect((await readNotice(USERS.marine, WORKSPACE_A))?.version).toBe(camille!.version);
    expect(await readNotice(USERS.hugo, WORKSPACE_A)).toBeNull();
  });
});

describe('export (exportMyData)', () => {
  it('donne à l’élève ses séances publiées, jamais les brouillons ni celles d’un autre élève, sans contenu binaire', async () => {
    const data = await exportMyData(USERS.camille, WORKSPACE_A);
    expect(data).not.toBeNull();
    // L’élève lit ses séances par les révisions publiées (politique workout_revision), jamais la table des brouillons.
    const athlete = data!.athlete as Record<string, { workout_id: string }[]>;
    const ids = athlete.workout_revisions!.map((w) => w.workout_id);
    expect(ids).toContain(SEED_WORKOUTS.camilleToday);
    expect(ids).not.toContain(SEED_WORKOUTS.camilleDraft);
    expect(ids).not.toContain(SEED_WORKOUTS.noahToday);
    expect((data!.roles as { athlete: boolean; coach: boolean }).athlete).toBe(true);
    expect(JSON.stringify(data)).not.toContain('"bytes"');
    expect(JSON.stringify(data)).not.toContain('_hash');
  });

  it('donne au coach ses propres tables, et rien à un coach d’un autre espace', async () => {
    const data = await exportMyData(USERS.marine, WORKSPACE_A);
    expect((data!.roles as { coach: boolean; owner: boolean }).owner).toBe(true);
    expect(Array.isArray((data!.coach as Record<string, unknown>).templates)).toBe(true);
    expect(await exportMyData(USERS.hugo, WORKSPACE_A)).toBeNull();
  });
});

describe('demandes (openPrivacyRequest, readPrivacyRequest)', () => {
  let erasureId = '';

  it('la portabilité est servie tout de suite, avec un chemin de téléchargement réservé à la personne', async () => {
    const r = await openPrivacyRequest(meta(USERS.camille), { kind: 'portability' });
    const body = r.body as { id: string; state: string; dueAt: string };
    expect(body.state).toBe('completed');
    const read = await readPrivacyRequest(USERS.camille, WORKSPACE_A, body.id);
    expect(read?.downloadPath).toContain(`/privacy/requests/${body.id}/download`);
    expect(await readPrivacyRequest(USERS.noah, WORKSPACE_A, body.id)).toBeNull();
    expect(await readPrivacyRequest(USERS.marine, WORKSPACE_A, body.id)).toBeNull();
  });

  it('l’effacement ouvre une demande à 30 jours et une tâche pour la propriétaire, sans doublon', async () => {
    const r = await openPrivacyRequest(meta(USERS.camille), { kind: 'erase' });
    const body = r.body as { id: string; state: string; dueAt: string };
    erasureId = body.id;
    expect(body.state).toBe('open');
    const days = (Date.parse(body.dueAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30.01);
    expect(await readPrivacyRequest(USERS.camille, WORKSPACE_A, erasureId)).toMatchObject({ state: 'open', downloadPath: null });

    const again = await openPrivacyRequest(meta(USERS.camille), { kind: 'erase' });
    expect((again.body as { id: string }).id).toBe(erasureId);
    const tasks = await db.query<{ n: string }>(
      `select count(*)::text as n from public.coach_tasks where workspace_id = $1 and athlete_id = $2 and assignee_id = $3 and kind = 'other' and title like 'Demande d’effacement%'`,
      [WORKSPACE_A, ATHLETES.camille, USERS.marine],
    );
    expect(tasks.rows[0]!.n).toBe('1');
    expect((await pendingErasure(USERS.marine, WORKSPACE_A, ATHLETES.camille))?.id).toBe(erasureId);
    expect(await pendingErasure(USERS.hugo, WORKSPACE_A, ATHLETES.camille)).toBeNull();
    expect((await listMyPrivacyRequests(USERS.camille, WORKSPACE_A)).map((x) => x.kind)).toEqual(['erase', 'portability']);
  });

  it('refuse une personne étrangère à l’espace et un type inconnu', async () => {
    expect(await codeOf(openPrivacyRequest(meta(USERS.hugo), { kind: 'access' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(openPrivacyRequest(meta(USERS.camille), { kind: 'forget' }))).toBe('INVALID_FIELDS');
  });

  it('la demande de la propriétaire est consignée sans tâche pour elle-même', async () => {
    const r = await openPrivacyRequest(meta(USERS.marine), { kind: 'erase' });
    expect((r.body as { state: string }).state).toBe('open');
    const tasks = await db.query<{ n: string }>(
      `select count(*)::text as n from public.coach_tasks where workspace_id = $1 and athlete_id is null and title like 'Demande d’effacement%'`,
      [WORKSPACE_A],
    );
    expect(tasks.rows[0]!.n).toBe('0');
  });
});

describe('effacement (eraseAthleteData)', () => {
  it('est réservé à la propriétaire de l’espace', async () => {
    expect(await codeOf(eraseAthleteData({ ...meta(USERS.hugo), athleteId: ATHLETES.camille }, fakeDeleteAuth))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(eraseAthleteData({ ...meta(USERS.camille), athleteId: ATHLETES.camille }, fakeDeleteAuth))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(eraseAthleteData({ ...meta(USERS.hugo, WORKSPACE_B), athleteId: ATHLETES.camille }, fakeDeleteAuth))).toBe('RESOURCE_NOT_VISIBLE');
    expect(deleted).toEqual([]);
  });

  it('vide toutes les tables du dossier, puis supprime le compte sans autre espace ; idempotent', async () => {
    // Des échanges pour exercer messages, conversations et curseurs de lecture.
    const conv = await openConversation({ ...meta(USERS.marine), athleteId: ATHLETES.camille });
    const cid = (conv.body as { id: string }).id;
    await sendMessage({ ...meta(USERS.camille), conversationId: cid }, { body: 'Bonjour coach, séance faite.' });
    await sendMessage({ ...meta(USERS.marine), conversationId: cid }, { body: 'Bravo !' });

    const tables = await athleteTables();
    expect(tables).toContain('workouts');
    expect(tables).toContain('messages');
    const before = await db.query<{ n: string }>('select count(*)::text as n from public.workouts where workspace_id = $1 and athlete_id = $2', [WORKSPACE_A, ATHLETES.camille]);
    expect(Number(before.rows[0]!.n)).toBeGreaterThan(0);

    const m = { ...meta(USERS.marine), athleteId: ATHLETES.camille };
    const r = await eraseAthleteData(m, fakeDeleteAuth);
    expect(r.body).toEqual({ erased: true, accountDeleted: true });
    expect(deleted).toEqual([USERS.camille]);

    for (const t of tables) {
      const c = await db.query<{ n: string }>(`select count(*)::text as n from public.${t} where workspace_id = $1 and athlete_id = $2`, [WORKSPACE_A, ATHLETES.camille]);
      expect(`${t}:${c.rows[0]!.n}`).toBe(`${t}:0`);
    }
    for (const { table, column } of await personTables()) {
      const c = await db.query<{ n: string }>(`select count(*)::text as n from public.${table} where ${column} = $1`, [USERS.camille]);
      expect(`${table}.${column}:${c.rows[0]!.n}`).toBe(`${table}.${column}:0`);
    }
    expect((await db.query('select 1 from public.users where id = $1', [USERS.camille])).rows).toEqual([]);
    expect((await db.query('select 1 from public.athletes where workspace_id = $1 and id = $2', [WORKSPACE_A, ATHLETES.camille])).rows).toEqual([]);
    const req = await db.query<{ state: string; user_id: string | null }>(`select state, user_id from public.privacy_requests where workspace_id = $1 and kind = 'erase' and user_id is null`, [WORKSPACE_A]);
    expect(req.rows.map((x) => x.state)).toContain('completed');

    // Rejouer la même intention : même réponse, aucune seconde suppression de compte.
    const replay = await eraseAthleteData(m, fakeDeleteAuth);
    expect(replay.body).toEqual({ erased: true, accountDeleted: true });
    expect(deleted).toEqual([USERS.camille]);

    // Les autres élèves ne bougent pas.
    const noah = await db.query<{ n: string }>('select count(*)::text as n from public.workouts where workspace_id = $1 and athlete_id = $2', [WORKSPACE_A, ATHLETES.noah]);
    expect(Number(noah.rows[0]!.n)).toBeGreaterThan(0);
    expect(await readNotice(USERS.noah, WORKSPACE_A)).not.toBeNull();
  });

  it('une fiche invitée sans compte est effacée sans toucher à un compte', async () => {
    const r = await eraseAthleteData({ ...meta(USERS.marine), athleteId: ATHLETES.ines }, fakeDeleteAuth);
    expect(r.body).toEqual({ erased: true, accountDeleted: false });
    expect(deleted).toEqual([USERS.camille]);
    expect((await db.query('select 1 from public.athletes where workspace_id = $1 and id = $2', [WORKSPACE_A, ATHLETES.ines])).rows).toEqual([]);
  });

  it('un dossier déjà effacé n’est plus visible', async () => {
    expect(await codeOf(eraseAthleteData({ ...meta(USERS.marine), athleteId: ATHLETES.camille }, fakeDeleteAuth))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
