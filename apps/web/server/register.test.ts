import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { TIME_ZONE, USERS, WORKSPACE_A } from './db/fixtures';
import { setMailer } from './email/send';
import { AppError } from './errors';
import { acceptInvitation, createAthlete, issueInvitation, registerFromInvitation, type CreateAuthUser } from './commands/invitations';
import { athleteContext } from './repo/context';

// D-020 : l’athlète crée son compte (adresse + mot de passe) depuis le lien d’invitation.

let db: Db;
let lastMail = '';
let created: string[] = [];
const meta = (actorId: string) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID() });
const tokenOf = () => /#token=([A-Za-z0-9_-]+)/.exec(lastMail)![1]!;

/** Faux Supabase Auth : crée la ligne auth.users, ou signale une adresse déjà prise. */
const fakeCreate: CreateAuthUser = async ({ email }) => {
  const taken = await db.query<{ id: string }>('select id from auth.users where email = $1', [email]);
  if (taken.rows[0]) return { exists: true };
  const id = randomUUID();
  await db.query('insert into auth.users(id, email) values ($1, $2)', [id, email]);
  created.push(email);
  return { userId: id };
};

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
}

async function invite(name: string, email: string) {
  const a = await createAthlete({ ...meta(USERS.marine), workspaceId: WORKSPACE_A }, { displayName: name, timeZone: TIME_ZONE });
  const aid = (a.body as { id: string }).id;
  await issueInvitation({ ...meta(USERS.marine), workspaceId: WORKSPACE_A, athleteId: aid, appOrigin: 'http://localhost:3000' }, { email });
  return { aid, token: tokenOf() };
}

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  setMailer(async (m) => void (lastMail = m.text));
});

describe('compte athlète créé depuis l’invitation', () => {
  it('refuse une autre adresse sans créer de compte', async () => {
    created = [];
    const { token } = await invite('Ana', 'ana@demo.coachos.test');
    const body = { token, displayName: 'Ana', email: 'pas-ana@demo.coachos.test', password: 'motdepasse-ana' };
    expect(await codeOf(registerFromInvitation(body, fakeCreate))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
    expect(created).toEqual([]);
  });

  it('refuse un mot de passe trop court sans créer de compte', async () => {
    created = [];
    const { token } = await invite('Bea', 'bea@demo.coachos.test');
    expect(await codeOf(registerFromInvitation({ token, displayName: 'Bea', email: 'bea@demo.coachos.test', password: 'court' }, fakeCreate))).toBe('INVALID_FIELDS');
    expect(created).toEqual([]);
  });

  it('bonne adresse : un compte, un profil, puis une seule relation', async () => {
    created = [];
    const { aid, token } = await invite('Cleo', 'cleo@demo.coachos.test');
    const reg = await registerFromInvitation({ token, displayName: ' Cléo ', email: 'Cleo@Demo.Coachos.test', password: 'motdepasse-cleo' }, fakeCreate);
    expect(created).toEqual(['cleo@demo.coachos.test']);
    const profile = await db.query<{ display_name: string }>('select display_name from public.users where id = $1', [reg.userId]);
    expect(profile.rows[0]?.display_name).toBe('Cléo');
    const acc = await acceptInvitation(meta(reg.userId), { token: reg.token });
    expect(acc.body).toEqual({ workspaceId: WORKSPACE_A, athleteId: aid });
    expect((await athleteContext(reg.userId, WORKSPACE_A))?.athlete.id).toBe(aid);
  });

  it('lien déjà utilisé, adresse déjà inscrite ou lien expiré : aucun compte créé', async () => {
    created = [];
    // Lien consommé par Cléo ci-dessus : réutilisation refusée.
    const used = await invite('Dora', 'dora@demo.coachos.test');
    await db.query(`update public.invitations set used_at = now() where secret_hash = sha256(convert_to($1, 'UTF8'))`, [used.token]);
    expect(await codeOf(registerFromInvitation({ token: used.token, displayName: 'Dora', email: 'dora@demo.coachos.test', password: 'motdepasse-dora' }, fakeCreate))).toBe('CONFLICT_OR_QUOTA');

    // Adresse qui a déjà un compte (Léa, fixture) : conflit, il faut se connecter.
    const lea = await invite('Léa bis', 'lea.moreau@demo.coachos.test');
    await db.query(`update auth.users set email = 'lea.moreau@demo.coachos.test' where id = $1`, [USERS.lea]);
    expect(await codeOf(registerFromInvitation({ token: lea.token, displayName: 'Léa', email: 'lea.moreau@demo.coachos.test', password: 'motdepasse-lea' }, fakeCreate))).toBe('CONFLICT_OR_QUOTA');

    const old = await invite('Eva', 'eva@demo.coachos.test');
    await db.query(`update public.invitations set expires_at = now() - interval '1 minute' where secret_hash = sha256(convert_to($1, 'UTF8'))`, [old.token]);
    expect(await codeOf(registerFromInvitation({ token: old.token, displayName: 'Eva', email: 'eva@demo.coachos.test', password: 'motdepasse-eva' }, fakeCreate))).toBe('CONFLICT_OR_QUOTA');
    expect(created).toEqual([]);
  });
});
