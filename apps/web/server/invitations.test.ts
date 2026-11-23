import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { USERS, WORKSPACE_A } from './db/fixtures';
import { setMailer, type EmailMessage } from './email/send';
import { AppError } from './errors';
import { acceptInvitation, createAthlete, createWorkspace, issueInvitation, latestInvitation, revokeInvitation } from './commands/invitations';
import { listAssignedAthletes } from './repo/coach';
import { athleteContext, coachContext, listWorkspaces } from './repo/context';

// Tranche C : espace, fiche, invitation et acceptation. Base PGlite en mémoire, e-mails capturés.

let db: Db;
const sent: EmailMessage[] = [];
const NINA = randomUUID(); // nouvelle coach
const ZOE = randomUUID(); // athlète invitée
const OTHER = randomUUID(); // compte avec une autre adresse
const ORIGIN = 'http://localhost:3000';

const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID() });
const tokenOf = (m: EmailMessage) => /#token=([A-Za-z0-9_-]+)/.exec(m.text)?.[1] ?? '';
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
  setMailer(async (m) => void sent.push(m));
  for (const [id, email, name] of [[NINA, 'nina@demo.coachos.test', 'Nina'], [ZOE, 'zoe@demo.coachos.test', 'Zoé'], [OTHER, 'autre@demo.coachos.test', 'Autre']]) {
    await db.query('insert into auth.users(id, email) values ($1, $2)', [id, email]);
    await db.query('insert into public.users(id, display_name) values ($1, $2)', [id, name]);
  }
});
afterAll(() => setMailer(undefined));

describe('créer un espace (C02-03, C02-04, C02-08)', () => {
  let wid = '';
  it('crée espace et rôle propriétaire ; même clé, même espace', async () => {
    const m = meta(NINA);
    const body = { name: '  Nina Run Club ', timeZone: 'Europe/Paris' };
    const a = await createWorkspace(m, body);
    const b = await createWorkspace(m, body);
    expect(b).toEqual(a);
    wid = (a.body as { id: string }).id;
    expect((a.body as { name: string }).name).toBe('Nina Run Club');
    const roles = await db.query<{ n: number }>('select count(*)::int as n from public.memberships where workspace_id = $1', [wid]);
    expect(roles.rows[0]!.n).toBe(1);
    expect((await coachContext(NINA, wid))?.role).toBe('owner');
    expect((await listWorkspaces(NINA)).map((w) => w.id)).toEqual([wid]);
  });

  it('refuse un fuseau inconnu par erreur de champ', async () => {
    expect(await codeOf(createWorkspace(meta(NINA), { name: 'X', timeZone: 'Mars/Olympus' }))).toBe('INVALID_FIELDS');
  });
});

describe('inviter et accepter (C03-01 à C03-05)', () => {
  let aid = '';
  let firstToken = '';

  it('le propriétaire crée une fiche invitée ; un autre coach ou un athlète ne peut pas', async () => {
    const r = await createAthlete({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { displayName: 'Zoé Laurent', timeZone: 'Europe/Brussels' });
    aid = (r.body as { id: string }).id;
    expect(r.body).toMatchObject({ state: 'invited' });
    expect((await listAssignedAthletes(USERS.marine, WORKSPACE_A)).find((a) => a.id === aid)?.state).toBe('invited');
    expect(await codeOf(createAthlete({ ...meta(USERS.hugo), workspaceId: WORKSPACE_A }, { displayName: 'X', timeZone: 'Europe/Brussels' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(createAthlete({ ...meta(USERS.camille), workspaceId: WORKSPACE_A }, { displayName: 'X', timeZone: 'Europe/Brussels' }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('l’invitation envoie un lien à usage unique ; ni le jeton ni l’adresse ne sont stockés en clair', async () => {
    const r = await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: ORIGIN }, { email: ' Zoe@Demo.Coachos.test ' });
    expect(r.status).toBe(201);
    const mail = sent.at(-1)!;
    expect(mail.to).toBe('zoe@demo.coachos.test');
    expect(mail.text).toContain(`${ORIGIN}/invite#token=`);
    firstToken = tokenOf(mail);
    const dump = await db.query<{ t: string }>(`select row_to_json(i)::text as t from public.invitations i where athlete_id = $1`, [aid]);
    expect(dump.rows[0]!.t).not.toContain(firstToken);
    expect(dump.rows[0]!.t).not.toContain('zoe@');
    expect((await latestInvitation(USERS.marine, WORKSPACE_A, aid))?.state).toBe('pending');
    expect(await latestInvitation(USERS.hugo, WORKSPACE_A, aid)).toBeNull();
  });

  it('un envoi d’e-mail en échec ne crée aucune invitation', async () => {
    const before = await db.query<{ n: number }>('select count(*)::int as n from public.invitations where athlete_id = $1', [aid]);
    setMailer(async () => {
      throw new AppError('TEMPORARILY_UNAVAILABLE', 'panne');
    });
    expect(await codeOf(issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: ORIGIN }, { email: 'zoe@demo.coachos.test' }))).toBe('TEMPORARILY_UNAVAILABLE');
    setMailer(async (m) => void sent.push(m));
    const after = await db.query<{ n: number }>('select count(*)::int as n from public.invitations where athlete_id = $1', [aid]);
    expect(after.rows[0]!.n).toBe(before.rows[0]!.n);
  });

  it('renvoyer remplace le lien : l’ancien échoue, le dernier reste valable (C03-05)', async () => {
    await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: ORIGIN }, { email: 'zoe@demo.coachos.test' });
    expect(await codeOf(acceptInvitation(meta(ZOE), { token: firstToken }))).toBe('CONFLICT_OR_QUOTA');
  });

  it('une autre adresse ne peut pas accepter (C03-03)', async () => {
    const token = tokenOf(sent.at(-1)!);
    expect(await codeOf(acceptInvitation(meta(OTHER), { token }))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
    expect(await codeOf(acceptInvitation(meta(ZOE), { token: 'x'.repeat(40) }))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('la bonne identité active exactement une relation ; rechargement sans doublon', async () => {
    const token = tokenOf(sent.at(-1)!);
    const m = meta(ZOE);
    const a = await acceptInvitation(m, { token });
    expect(a.body).toEqual({ workspaceId: WORKSPACE_A, athleteId: aid });
    expect(await acceptInvitation(m, { token })).toEqual(a); // double clic
    expect(await acceptInvitation(meta(ZOE), { token })).toEqual(a); // rechargement, autre clé
    expect(await codeOf(acceptInvitation(meta(OTHER), { token }))).toBe('CONFLICT_OR_QUOTA'); // lien consommé
    expect((await athleteContext(ZOE, WORKSPACE_A))?.athlete.id).toBe(aid);
    expect(await athleteContext(OTHER, WORKSPACE_A)).toBeNull();
    const rows = await db.query<{ n: number }>('select count(*)::int as n from public.athletes where workspace_id = $1 and user_id = $2', [WORKSPACE_A, ZOE]);
    expect(rows.rows[0]!.n).toBe(1);
    expect((await latestInvitation(USERS.marine, WORKSPACE_A, aid))?.state).toBe('used');
    expect(await codeOf(issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: ORIGIN }, { email: 'zoe@demo.coachos.test' }))).toBe('CONFLICT_OR_QUOTA');
  });

  it('un lien révoqué ou expiré ne relie plus de compte (C03-04)', async () => {
    const r = await createAthlete({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { displayName: 'Autre athlète', timeZone: 'Europe/Brussels' });
    const other = (r.body as { id: string }).id;
    const inv = await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: other, appOrigin: ORIGIN }, { email: 'autre@demo.coachos.test' });
    const token = tokenOf(sent.at(-1)!);
    const iid = (inv.body as { invitationId: string }).invitationId;
    expect(await codeOf(revokeInvitation({ ...meta(USERS.hugo), workspaceId: WORKSPACE_A, invitationId: iid }))).toBe('RESOURCE_NOT_VISIBLE');
    await revokeInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, invitationId: iid });
    expect(await codeOf(acceptInvitation(meta(OTHER), { token }))).toBe('CONFLICT_OR_QUOTA');

    await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: other, appOrigin: ORIGIN }, { email: 'autre@demo.coachos.test' });
    const fresh = tokenOf(sent.at(-1)!);
    await db.query(`update public.invitations set expires_at = now() - interval '1 minute' where athlete_id = $1 and revoked_at is null`, [other]);
    expect(await codeOf(acceptInvitation(meta(OTHER), { token: fresh }))).toBe('CONFLICT_OR_QUOTA');
    expect((await latestInvitation(USERS.marine, WORKSPACE_A, other))?.state).toBe('expired');
  });
});

describe('lien d’invitation à copier, sans e-mail (D-149)', () => {
  const LIEN = randomUUID(); // élève qui recevra le lien par SMS
  const linkOf = (b: unknown) => /#token=([A-Za-z0-9_-]+)$/.exec((b as { link?: string }).link ?? '')?.[1] ?? '';
  let aid = '';

  beforeAll(async () => {
    await db.query('insert into auth.users(id, email) values ($1, $2)', [LIEN, 'lien@demo.coachos.test']);
    await db.query('insert into public.users(id, display_name) values ($1, $2)', [LIEN, 'Lina']);
    const r = await createAthlete({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { displayName: 'Lina Lien', timeZone: 'Europe/Brussels' });
    aid = (r.body as { id: string }).id;
  });

  it('rend le lien au coach sans envoyer d’e-mail ; même clé, même lien ; rien n’est stocké en clair', async () => {
    const before = sent.length;
    const m = { ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: ORIGIN };
    const r = await issueInvitation(m, { email: 'Lien@Demo.Coachos.test', delivery: 'link' });
    expect(r.status).toBe(201);
    expect(sent.length).toBe(before);
    const link = (r.body as { link: string }).link;
    expect(link.startsWith(`${ORIGIN}/invite#token=`)).toBe(true);
    const token = linkOf(r.body);
    expect(token.length).toBeGreaterThanOrEqual(40);
    // Rejeu de la même clé (réseau coupé, double clic) : le même lien, recalculé.
    expect(linkOf((await issueInvitation(m, { email: 'Lien@Demo.Coachos.test', delivery: 'link' })).body)).toBe(token);
    const inv = await db.query<{ t: string }>(`select row_to_json(i)::text as t from public.invitations i where athlete_id = $1`, [aid]);
    expect(inv.rows.map((x) => x.t).join()).not.toContain(token);
    expect(inv.rows.map((x) => x.t).join()).not.toContain('lien@');
    const keys = await db.query<{ t: string }>(`select coalesce(response::text, '') as t from public.operation_keys where workspace_id = $1`, [WORKSPACE_A]);
    expect(keys.rows.map((x) => x.t).join()).not.toContain(token);
  });

  it('un autre coach ou un élève ne peut pas créer de lien', async () => {
    const as = (u: string) => issueInvitation({ ...meta(u), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: ORIGIN }, { email: 'lien@demo.coachos.test', delivery: 'link' });
    expect(await codeOf(as(USERS.hugo))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(as(USERS.camille))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(as(LIEN))).toBe('RESOURCE_NOT_VISIBLE');
  });

  it('un nouveau lien remplace l’ancien ; seule l’adresse saisie peut l’accepter', async () => {
    const issue = () => issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: ORIGIN }, { email: 'lien@demo.coachos.test', delivery: 'link' });
    const old = linkOf((await issue()).body);
    const token = linkOf((await issue()).body);
    expect(token).not.toBe(old);
    expect(await codeOf(acceptInvitation(meta(LIEN), { token: old }))).toBe('CONFLICT_OR_QUOTA');
    expect(await codeOf(acceptInvitation(meta(OTHER), { token }))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
    const a = await acceptInvitation(meta(LIEN), { token });
    expect(a.body).toEqual({ workspaceId: WORKSPACE_A, athleteId: aid });
    expect((await athleteContext(LIEN, WORKSPACE_A))?.athlete.id).toBe(aid);
  });

  it('sans remise précisée, l’invitation part toujours par e-mail et ne rend pas de lien', async () => {
    const r = await createAthlete({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { displayName: 'Par E-mail', timeZone: 'Europe/Brussels' });
    const before = sent.length;
    const inv = await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: (r.body as { id: string }).id, appOrigin: ORIGIN }, { email: 'mail@demo.coachos.test' });
    expect(sent.length).toBe(before + 1);
    expect((inv.body as { link?: string }).link).toBeUndefined();
  });
});
