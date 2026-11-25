import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { USERS, WORKSPACE_A } from './db/fixtures';
import { AppError } from './errors';
import { acceptInvitation, checkInvitationForEmail, createAthlete, createWorkspace, issueInvitation } from './commands/invitations';
import { LIMIT_REACHED, readWorkspaceOffer } from './commands/workspace-offer';

// D-175 : essai gratuit posé à la création, limite d’élèves actifs à l’activation, lecture réservée aux coachs.

let db: Db;
const ORIGIN = 'http://localhost:3000';
const LEA = randomUUID(); // nouvelle coach
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

/** Nouvelle coach, son espace, et deux élèves invités par lien, chacun avec son compte. */
async function spaceWithTwoInvites() {
  const wid = ((await createWorkspace(meta(LEA), { name: 'Léa Trail', timeZone: 'Europe/Brussels' })).body as { id: string }).id;
  const invites: { user: string; email: string; token: string }[] = [];
  for (const n of [1, 2]) {
    const user = randomUUID();
    const email = `eleve${n}.${user.slice(0, 8)}@demo.coachos.test`;
    await db.query('insert into auth.users(id, email) values ($1, $2)', [user, email]);
    await db.query('insert into public.users(id, display_name) values ($1, $2)', [user, `Élève ${n}`]);
    const aid = ((await createAthlete({ ...meta(LEA), workspaceId: wid }, { displayName: `Élève ${n}`, timeZone: 'Europe/Brussels' })).body as { id: string }).id;
    const r = await issueInvitation({ ...meta(LEA), workspaceId: wid, athleteId: aid, appOrigin: ORIGIN }, { email, delivery: 'link' });
    invites.push({ user, email, token: /#token=([A-Za-z0-9_-]+)/.exec((r.body as { link: string }).link)![1]! });
  }
  return { wid, invites };
}

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  await db.query('insert into auth.users(id, email) values ($1, $2)', [LEA, 'lea.trail@demo.coachos.test']);
  await db.query('insert into public.users(id, display_name) values ($1, $2)', [LEA, 'Léa']);
});
afterEach(() => vi.unstubAllEnvs());

describe('essai gratuit (D-175)', () => {
  it('interrupteur éteint : l’espace naît en phase pilote, sans limite', async () => {
    const wid = ((await createWorkspace(meta(LEA), { name: 'Pilote', timeZone: 'Europe/Brussels' })).body as { id: string }).id;
    const row = await db.query<{ trial_ends_at: Date | null; plan: string | null }>('select trial_ends_at, plan from public.workspaces where id = $1', [wid]);
    expect(row.rows[0]).toEqual({ trial_ends_at: null, plan: null });
    expect(await readWorkspaceOffer(LEA, wid)).toMatchObject({ standing: { kind: 'pilot' }, active: 0, limit: null });
  });

  it('interrupteur allumé : essai de 30 jours, aux limites de l’offre Pro', async () => {
    vi.stubEnv('COACHOS_BILLING', '1');
    const before = Date.now();
    const wid = ((await createWorkspace(meta(LEA), { name: 'Essai', timeZone: 'Europe/Brussels' })).body as { id: string }).id;
    const view = await readWorkspaceOffer(LEA, wid);
    expect(view.standing).toMatchObject({ kind: 'trial', daysLeft: 30, offer: { id: 'pro' } });
    expect(view.limit).toBe(100);
    if (view.standing.kind !== 'trial') throw new Error('essai attendu');
    const days = (view.standing.endsAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThan(30.01);
  });
});

describe('limite d’élèves actifs (D-175)', () => {
  it('bloque l’activation au-delà de l’offre, avant même la création du compte ; le lien reste valable', async () => {
    const { wid, invites } = await spaceWithTwoInvites();
    vi.stubEnv('COACHOS_BILLING', '1');
    vi.stubEnv('COACHOS_OFFERS', '[{"id":"starter","athletes":1}]');
    await db.query(`update public.workspaces set plan = 'starter' where id = $1`, [wid]);

    const [first, second] = invites as [typeof invites[0], typeof invites[0]];
    expect(await codeOf(acceptInvitation(meta(first.user), { token: first.token }))).toBe('OK');
    const err = await checkInvitationForEmail(second.token, second.email).catch((e: unknown) => e);
    expect((err as AppError).code).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
    expect((err as AppError).message).toBe(LIMIT_REACHED);
    expect(await codeOf(acceptInvitation(meta(second.user), { token: second.token }))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED');
    const used = await db.query<{ n: number }>('select count(*)::int as n from public.invitations where workspace_id = $1 and used_at is not null', [wid]);
    expect(used.rows[0]!.n).toBe(1);
    expect(await readWorkspaceOffer(LEA, wid)).toMatchObject({ active: 1, limit: 1, standing: { kind: 'plan' } });

    // Une place de plus (offre corrigée) : le même lien passe.
    vi.stubEnv('COACHOS_OFFERS', '[{"id":"starter","athletes":2}]');
    expect(await codeOf(acceptInvitation(meta(second.user), { token: second.token }))).toBe('OK');
  });

  it('phase pilote : aucune limite, même avec une offre posée', async () => {
    const { wid, invites } = await spaceWithTwoInvites();
    vi.stubEnv('COACHOS_OFFERS', '[{"id":"starter","athletes":1}]');
    await db.query(`update public.workspaces set plan = 'starter' where id = $1`, [wid]);
    for (const i of invites) expect(await codeOf(acceptInvitation(meta(i.user), { token: i.token }))).toBe('OK');
  });
});

describe('droits de lecture de l’offre (D-175)', () => {
  it('coach de l’espace oui ; coach d’un autre espace, élève affecté, élève tiers non', async () => {
    expect(await codeOf(readWorkspaceOffer(USERS.marine, WORKSPACE_A))).toBe('OK');
    expect(await codeOf(readWorkspaceOffer(USERS.hugo, WORKSPACE_A))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(readWorkspaceOffer(USERS.camille, WORKSPACE_A))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(readWorkspaceOffer(USERS.lea, WORKSPACE_A))).toBe('RESOURCE_NOT_VISIBLE');
  });
});
