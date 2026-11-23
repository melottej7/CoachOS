import {
  acceptInvitationSchema,
  inviteRegisterSchema,
  createAthleteSchema,
  createWorkspaceSchema,
  INVITATION_TTL_DAYS,
  inviteSchema,
  parseWith,
} from '@coachos/domain';
import { commandAs, systemTx, type Tx } from '../db/client';
import { randomUUID } from 'node:crypto';
import { emailHmac, linkInvitationToken, newInvitationToken, sha256 } from '../crypto';
import { invitationEmail, sendEmail } from '../email/send';
import { AppError, conflict, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';

interface Meta {
  actorId: string;
  idempotencyKey: string;
  requestId: string;
}

/**
 * createWorkspace (X04, C02-03/04/08) : espace + rôle propriétaire dans une seule transaction.
 * Même clé → même espace, jamais de second rôle.
 */
export async function createWorkspace(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(createWorkspaceSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { name, timeZone } = parsed.value;
  return commandAs(meta.actorId, async (tx) => {
    const user = await tx.query<{ ok: boolean }>('select exists(select 1 from public.users where id = $1) as ok', [meta.actorId]);
    if (!user.rows[0]?.ok) throw new AppError('AUTH_REQUIRED_OR_INVALID_SIGNATURE', 'Session expirée. Reconnecte-toi pour continuer.');
    return idempotent(tx, { actorId: meta.actorId, action: 'workspace.create', key: meta.idempotencyKey, body }, async () => {
      const ws = await tx.query<{ id: string }>('insert into public.workspaces(name, time_zone) values ($1, $2) returning id', [name, timeZone]);
      const id = ws.rows[0]!.id;
      await tx.query(`insert into public.memberships(workspace_id, user_id, role) values ($1, $2, 'owner')`, [id, meta.actorId]);
      await audit(tx, id, meta.actorId, 'workspace.create', id, meta.requestId);
      return { status: 201, body: { id, name, timeZone } };
    });
  });
}

export async function requireOwner(tx: Tx, wid: string) {
  const r = await tx.query<{ coach: boolean; owner: boolean }>(
    'select private.current_coach($1) as coach, private.current_owner($1) as owner',
    [wid],
  );
  if (!r.rows[0]?.coach) throw notVisible();
  if (!r.rows[0].owner) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Seul le propriétaire de l’espace peut faire cette action.');
}

/** createAthlete (X13, C03-01) : fiche « invitée », affectée au propriétaire. */
export async function createAthlete(meta: Meta & { workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(createAthleteSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { displayName, timeZone } = parsed.value;
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.create', key: meta.idempotencyKey, body }, async () => {
      const a = await tx.query<{ id: string }>(
        `insert into public.athletes(workspace_id, display_name, time_zone, state) values ($1, $2, $3, 'invited') returning id`,
        [wid, displayName, timeZone],
      );
      const id = a.rows[0]!.id;
      await tx.query('insert into public.coach_assignments(workspace_id, athlete_id, coach_id) values ($1, $2, $3)', [wid, id, meta.actorId]);
      await audit(tx, wid, meta.actorId, 'athlete.create', id, meta.requestId);
      return { status: 201, body: { id, state: 'invited' } };
    });
  });
}

/**
 * issueInvitation (C03-02, C03-05) : remplace le lien actif, stocke seulement l’empreinte du jeton
 * et de l’adresse, envoie l’e-mail dans la transaction. Si l’envoi échoue, rien n’est créé et la
 * même clé peut être rejouée. Le jeton est placé après # : il n’atteint jamais les journaux serveur.
 * D-149 : en remise « link », aucun e-mail ; le lien est rendu au coach, recalculé à chaque réponse
 * (y compris au rejeu de la même clé) et jamais stocké, ni dans l’invitation ni dans la réponse enregistrée.
 */
export async function issueInvitation(
  meta: Meta & { workspaceId: string; athleteId: string; appOrigin: string },
  body: unknown,
): Promise<StoredResponse> {
  const parsed = parseWith(inviteSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { email, delivery } = parsed.value;
  const { workspaceId: wid, athleteId: aid } = meta;
  return commandAs(meta.actorId, async (tx) => {
    const ok = await tx.query<{ ok: boolean; state: string | null; wname: string; coach: string | null; tagline: string | null }>(
      `select private.assigned($1, $2) as ok,
              (select state from public.athletes where workspace_id = $1 and id = $2) as state,
              (select name from public.workspaces where id = $1) as wname,
              (select display_name from public.users where id = auth.uid()) as coach,
              (select tagline from public.workspace_profiles where workspace_id = $1) as tagline`,
      [wid, aid],
    );
    const row = ok.rows[0];
    if (!row?.ok || !row.state) throw notVisible();
    if (row.state !== 'invited') throw conflict('Cet athlète a déjà rejoint l’espace ou n’est plus actif.');

    const res = await idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'invitation.issue', key: meta.idempotencyKey, body }, async () => {
      await tx.query(
        `update public.invitations set revoked_at = now()
         where workspace_id = $1 and athlete_id = $2 and used_at is null and revoked_at is null`,
        [wid, aid],
      );
      const id = randomUUID();
      const token = delivery === 'link' ? linkInvitationToken(id) : newInvitationToken();
      const inv = await tx.query<{ expires_at: Date }>(
        `insert into public.invitations(id, workspace_id, athlete_id, secret_hash, email_hmac, expires_at)
         values ($1, $2, $3, $4, $5, now() + make_interval(days => $6)) returning expires_at`,
        [id, wid, aid, sha256(token), emailHmac(email), INVITATION_TTL_DAYS],
      );
      const { expires_at } = inv.rows[0]!;
      await audit(tx, wid, meta.actorId, 'invitation.issue', id, meta.requestId);
      if (delivery === 'email') {
        await sendEmail(invitationEmail(email, row.wname, `${meta.appOrigin}/invite#token=${token}`, INVITATION_TTL_DAYS, row.coach, row.tagline));
      }
      return { status: 201, body: { invitationId: id, expiresAt: new Date(expires_at).toISOString() } };
    });
    if (delivery !== 'link') return res;
    const invitationId = (res.body as { invitationId: string }).invitationId;
    return { ...res, body: { ...(res.body as object), link: `${meta.appOrigin}/invite#token=${linkInvitationToken(invitationId)}` } };
  });
}

/** revokeInvitation (C03-04) : idempotent ; un lien déjà accepté ne se révoque plus. */
export async function revokeInvitation(meta: Meta & { workspaceId: string; invitationId: string }): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    const r = await tx.query<{ used_at: Date | null; revoked_at: Date | null }>(
      'select used_at, revoked_at from public.invitations where workspace_id = $1 and id = $2 for update',
      [wid, meta.invitationId],
    );
    const inv = r.rows[0];
    if (!inv) throw notVisible();
    if (inv.used_at) throw conflict('Cette invitation a déjà été acceptée.');
    if (!inv.revoked_at) {
      await tx.query('update public.invitations set revoked_at = now() where workspace_id = $1 and id = $2', [wid, meta.invitationId]);
      await audit(tx, wid, meta.actorId, 'invitation.revoke', meta.invitationId, meta.requestId);
    }
    return { status: 200, body: { revoked: true } };
  });
}

/**
 * acceptInvitation (X06, C03-03) : une identité dont l’e-mail vérifié correspond active exactement
 * une relation. Les messages ne révèlent ni l’adresse attendue ni l’espace si le lien est invalide.
 */
export async function acceptInvitation(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(acceptInvitationSchema, body);
  if (!parsed.ok) throw new AppError('RESOURCE_NOT_VISIBLE', 'Ce lien d’invitation n’est pas valable.');
  const hash = sha256(parsed.value.token);

  return commandAs(meta.actorId, async (tx) => {
    return idempotent(tx, { actorId: meta.actorId, action: 'invitation.accept', key: meta.idempotencyKey, body: { hash: hash.toString('hex') } }, async () => {
      const r = await tx.query<{
        workspace_id: string; athlete_id: string; email_hmac: Buffer | Uint8Array; expired: boolean;
        used_at: Date | null; revoked_at: Date | null; athlete_user: string | null; athlete_state: string;
      }>(
        `select i.workspace_id, i.athlete_id, i.email_hmac, i.expires_at <= now() as expired, i.used_at, i.revoked_at,
                a.user_id as athlete_user, a.state as athlete_state
         from public.invitations i
         join public.athletes a on a.workspace_id = i.workspace_id and a.id = i.athlete_id
         where i.secret_hash = $1
         for update of i, a`,
        [hash],
      );
      const inv = r.rows[0];
      if (!inv) throw new AppError('RESOURCE_NOT_VISIBLE', 'Ce lien d’invitation n’est pas valable.');
      const done = { status: 200, body: { workspaceId: inv.workspace_id, athleteId: inv.athlete_id } };
      if (inv.used_at) {
        if (inv.athlete_user === meta.actorId) return done; // rechargement après acceptation
        throw conflict('Ce lien a déjà été utilisé. Demande un nouveau lien à ton coach.');
      }
      if (inv.revoked_at) throw conflict('Ce lien a été remplacé ou annulé. Utilise le dernier e-mail reçu ou demande un nouveau lien à ton coach.');
      if (inv.expired) throw conflict('Ce lien a expiré. Demande un nouveau lien à ton coach.');

      const me = await tx.query<{ email: string | null; confirmed: boolean }>(
        `select u.email, coalesce((to_jsonb(u) ->> 'email_confirmed_at') is not null or not (to_jsonb(u) ? 'email_confirmed_at'), false) as confirmed
         from auth.users u where u.id = $1`,
        [meta.actorId],
      );
      const user = me.rows[0];
      if (!user?.email || !user.confirmed) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Confirme d’abord ton adresse e-mail en te connectant par lien.');
      if (!Buffer.from(inv.email_hmac).equals(emailHmac(user.email))) {
        throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Cette invitation a été envoyée à une autre adresse e-mail. Connecte-toi avec l’adresse qui a reçu l’e-mail.');
      }
      if (inv.athlete_state !== 'invited') throw conflict('Cette invitation n’est plus active.');
      const already = await tx.query<{ ok: boolean }>(
        'select exists(select 1 from public.athletes where workspace_id = $1 and user_id = $2) as ok',
        [inv.workspace_id, meta.actorId],
      );
      if (already.rows[0]?.ok) throw conflict('Ton compte est déjà relié à un dossier de cet espace.');

      await tx.query(`update public.athletes set user_id = $3, state = 'active' where workspace_id = $1 and id = $2`, [
        inv.workspace_id, inv.athlete_id, meta.actorId,
      ]);
      await tx.query('update public.invitations set used_at = now() where workspace_id = $1 and secret_hash = $2', [inv.workspace_id, hash]);
      await audit(tx, inv.workspace_id, meta.actorId, 'invitation.accept', inv.athlete_id, meta.requestId);
      return done;
    });
  });
}

export interface InvitationStatus {
  id: string;
  createdAt: string;
  expiresAt: string;
  state: 'pending' | 'expired' | 'used' | 'revoked';
}

/** Dernière invitation d’un dossier, pour le coach affecté. La table n’est pas exposée en RLS. */
export async function latestInvitation(userId: string, wid: string, aid: string): Promise<InvitationStatus | null> {
  return commandAs(userId, async (tx) => {
    const ok = await tx.query<{ ok: boolean }>('select private.assigned($1, $2) as ok', [wid, aid]);
    if (!ok.rows[0]?.ok) return null;
    const r = await tx.query<{ id: string; created_at: Date; expires_at: Date; used_at: Date | null; revoked_at: Date | null; expired: boolean }>(
      `select id, created_at, expires_at, used_at, revoked_at, expires_at <= now() as expired
       from public.invitations where workspace_id = $1 and athlete_id = $2 order by created_at desc, id limit 1`,
      [wid, aid],
    );
    const x = r.rows[0];
    if (!x) return null;
    const state = x.used_at ? 'used' : x.revoked_at ? 'revoked' : x.expired ? 'expired' : 'pending';
    return { id: x.id, createdAt: new Date(x.created_at).toISOString(), expiresAt: new Date(x.expires_at).toISOString(), state };
  });
}

/**
 * Avant de créer un compte depuis une invitation (D-020) : le lien doit être valable et destiné
 * à cette adresse. Aucun effet de bord ; les messages ne révèlent pas l’adresse attendue.
 */
export async function checkInvitationForEmail(token: string, email: string): Promise<void> {
  await systemTx(async (tx) => {
    const r = await tx.query<{ email_hmac: Buffer | Uint8Array; expired: boolean; used_at: Date | null; revoked_at: Date | null; state: string }>(
      `select i.email_hmac, i.expires_at <= now() as expired, i.used_at, i.revoked_at, a.state
       from public.invitations i join public.athletes a on a.workspace_id = i.workspace_id and a.id = i.athlete_id
       where i.secret_hash = $1`,
      [sha256(token)],
    );
    const inv = r.rows[0];
    if (!inv) throw new AppError('RESOURCE_NOT_VISIBLE', 'Ce lien d’invitation n’est pas valable.');
    if (inv.used_at) throw conflict('Ce lien a déjà été utilisé. Connecte-toi si tu as déjà rejoint l’espace.');
    if (inv.revoked_at) throw conflict('Ce lien a été remplacé ou annulé. Utilise le dernier e-mail reçu ou demande un nouveau lien à ton coach.');
    if (inv.expired) throw conflict('Ce lien a expiré. Demande un nouveau lien à ton coach.');
    if (inv.state !== 'invited') throw conflict('Cette invitation n’est plus active.');
    if (!Buffer.from(inv.email_hmac).equals(emailHmac(email))) {
      throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Cette adresse ne correspond pas à l’invitation. Utilise l’adresse qui a reçu l’e-mail.', [
        { path: 'email', rule: 'Adresse différente de celle invitée' },
      ]);
    }
  });
}

export type CreateAuthUser = (input: { email: string; password: string; displayName: string }) => Promise<{ userId: string } | { exists: true }>;

/**
 * Création du compte athlète depuis l’invitation : vérifier le lien et l’adresse, créer le compte
 * (adresse considérée vérifiée : le lien a été reçu à cette adresse), puis le profil.
 * L’acceptation se fait ensuite avec la session ouverte (acceptInvitation).
 */
export async function registerFromInvitation(body: unknown, createUser: CreateAuthUser): Promise<{ userId: string; token: string; email: string; password: string }> {
  const parsed = parseWith(inviteRegisterSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { token, email, password, displayName } = parsed.value;
  await checkInvitationForEmail(token, email);
  const created = await createUser({ email, password, displayName });
  if ('exists' in created) {
    throw conflict('Un compte existe déjà avec cette adresse. Utilise « J’ai déjà un compte » pour te connecter.');
  }
  await systemTx(async (tx) => {
    await tx.query('insert into public.users(id, display_name) values ($1, $2) on conflict (id) do nothing', [created.userId, displayName]);
  });
  return { userId: created.userId, token, email, password };
}
