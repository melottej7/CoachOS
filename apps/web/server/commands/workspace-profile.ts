import {
  detectImageType, LOGO_MAX_BYTES, parseWith, workspaceProfileSchema,
  type Accent, type CoachGoal, type Level, type SpokenLanguage, type Sport,
} from '@coachos/domain';
import { commandAs, readAs, systemTx, type Tx } from '../db/client';
import { sha256 } from '../crypto';
import { AppError, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';
import { requireOwner } from './invitations';

export interface WorkspaceProfile {
  tagline: string | null;
  bio: string | null;
  approach: string | null;
  experienceYears: number | null;
  certifications: string[];
  sports: Sport[];
  audiences: Level[];
  goals: CoachGoal[];
  city: string | null;
  languages: SpokenLanguage[];
  websiteUrl: string | null;
  socialUrl: string | null;
  contactEmail: string | null;
  accent: Accent;
  revision: number;
  updatedAt: string;
}

/** Vue publique d’un espace : ce que voient ses athlètes et une personne invitée. */
export interface WorkspacePublic {
  id: string;
  name: string;
  coachName: string | null;
  profile: WorkspaceProfile | null;
  logoVersion: string | null;
}

type Row = {
  tagline: string | null; bio: string | null; approach: string | null; experience_years: number | null; certifications: string[];
  sports: Sport[]; audiences: Level[]; goals: CoachGoal[]; city: string | null; languages: SpokenLanguage[]; website_url: string | null;
  social_url: string | null; contact_email: string | null; accent: Accent; revision: number; updated_at: Date;
};

const columns = `tagline, bio, approach, experience_years, certifications, sports, audiences, goals, city, languages,
  website_url, social_url, contact_email, accent, revision, updated_at`;

const toProfile = (r: Row): WorkspaceProfile => ({
  tagline: r.tagline, bio: r.bio, approach: r.approach, experienceYears: r.experience_years,
  certifications: r.certifications ?? [], sports: r.sports ?? [], audiences: r.audiences ?? [], goals: r.goals ?? [],
  city: r.city, languages: r.languages ?? [], websiteUrl: r.website_url, socialUrl: r.social_url, contactEmail: r.contact_email,
  accent: r.accent, revision: r.revision, updatedAt: new Date(r.updated_at).toISOString(),
});

/** Partie publique hors RLS (nom du coach propriétaire, version du logo) : informations destinées à être montrées. */
async function publicExtras(tx: Tx, wid: string) {
  const r = await tx.query<{ coach: string | null; logo: Date | null }>(
    `select (select u.display_name from public.memberships m join public.users u on u.id = m.user_id
             where m.workspace_id = $1 and m.role = 'owner' and m.active limit 1) as coach,
            (select updated_at from public.workspace_logos where workspace_id = $1) as logo`,
    [wid],
  );
  const x = r.rows[0];
  return { coachName: x?.coach ?? null, logoVersion: x?.logo ? String(new Date(x.logo).getTime()) : null };
}

async function buildPublic(tx: Tx, wid: string): Promise<WorkspacePublic | null> {
  const w = await tx.query<{ name: string }>('select name from public.workspaces where id = $1', [wid]);
  if (!w.rows[0]) return null;
  const p = await tx.query<Row>(`select ${columns} from public.workspace_profiles where workspace_id = $1`, [wid]);
  return { id: wid, name: w.rows[0].name, profile: p.rows[0] ? toProfile(p.rows[0]) : null, ...(await publicExtras(tx, wid)) };
}

/** Lecture par un membre de l’espace (coach ou athlète) : présentation sous RLS, puis compléments publics. */
export async function readWorkspacePublic(userId: string, wid: string): Promise<WorkspacePublic | null> {
  const visible = await readAs(userId, async (tx) => {
    const w = await tx.query<{ name: string }>('select name from public.workspaces where id = $1', [wid]);
    if (!w.rows[0]) return null;
    const p = await tx.query<Row>(`select ${columns} from public.workspace_profiles where workspace_id = $1`, [wid]);
    return { name: w.rows[0].name, profile: p.rows[0] ? toProfile(p.rows[0]) : null };
  });
  if (!visible) return null;
  const extras = await systemTx((tx) => publicExtras(tx, wid));
  return { id: wid, ...visible, ...extras };
}

/**
 * Aperçu pour une personne invitée, avant la création de son compte : seulement si le lien est
 * valable. Ne renvoie aucune donnée d’athlète ni l’adresse invitée.
 */
export async function previewInvitation(token: unknown): Promise<WorkspacePublic> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw notVisible();
  return systemTx(async (tx) => {
    const r = await tx.query<{ workspace_id: string }>(
      `select workspace_id from public.invitations
       where secret_hash = $1 and used_at is null and revoked_at is null and expires_at > now()`,
      [sha256(token)],
    );
    const wid = r.rows[0]?.workspace_id;
    const view = wid ? await buildPublic(tx, wid) : null;
    if (!view) throw new AppError('RESOURCE_NOT_VISIBLE', 'Ce lien d’invitation n’est pas valable.');
    return view;
  });
}

/** saveWorkspaceProfile · O : nom de l’espace et présentation complète. */
export async function saveWorkspaceProfile(meta: { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(workspaceProfileSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const p = parsed.value;
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'workspace.profile', key: meta.idempotencyKey, body }, async () => {
      await tx.query('update public.workspaces set name = $2 where id = $1', [wid, p.name]);
      const r = await tx.query<Row>(
        `insert into public.workspace_profiles(workspace_id, tagline, bio, approach, experience_years, certifications, sports, audiences,
           goals, city, languages, website_url, social_url, contact_email, accent)
         values ($1, $2, $3, $4, $5, $6::text[], $7::text[], $8::text[], $9::text[], $10, $11::text[], $12, $13, $14, $15)
         on conflict (workspace_id) do update set
           tagline = excluded.tagline, bio = excluded.bio, approach = excluded.approach, experience_years = excluded.experience_years,
           certifications = excluded.certifications, sports = excluded.sports, audiences = excluded.audiences, goals = excluded.goals,
           city = excluded.city, languages = excluded.languages, website_url = excluded.website_url, social_url = excluded.social_url,
           contact_email = excluded.contact_email, accent = excluded.accent,
           revision = public.workspace_profiles.revision + 1, updated_at = now()
         returning ${columns}`,
        [wid, p.tagline, p.bio, p.approach, p.experienceYears, p.certifications, p.sports, p.audiences, p.goals, p.city, p.languages,
          p.websiteUrl, p.socialUrl, p.contactEmail, p.accent],
      );
      await audit(tx, wid, meta.actorId, 'workspace.profile', wid, meta.requestId);
      return { status: 200, body: { name: p.name, item: toProfile(r.rows[0]!) } };
    });
  });
}

/** Logo ou photo : type vérifié par signature binaire, 512 Kio au plus, propriétaire seulement. */
export async function setWorkspaceLogo(meta: { actorId: string; requestId: string; workspaceId: string }, bytes: Uint8Array): Promise<StoredResponse> {
  if (bytes.length === 0) throw invalid([{ path: 'logo', rule: 'Fichier vide' }]);
  if (bytes.length > LOGO_MAX_BYTES) throw invalid([{ path: 'logo', rule: 'Image trop lourde (512 Kio au plus)' }]);
  const type = detectImageType(bytes);
  if (!type) throw invalid([{ path: 'logo', rule: 'Format accepté : PNG, JPEG ou WebP' }]);
  return commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, meta.workspaceId);
    const r = await tx.query<{ updated_at: Date }>(
      `insert into public.workspace_logos(workspace_id, content_type, bytes) values ($1, $2, $3)
       on conflict (workspace_id) do update set content_type = excluded.content_type, bytes = excluded.bytes, updated_at = now()
       returning updated_at`,
      [meta.workspaceId, type, Buffer.from(bytes)],
    );
    await audit(tx, meta.workspaceId, meta.actorId, 'workspace.logo', meta.workspaceId, meta.requestId);
    return { status: 200, body: { logoVersion: String(new Date(r.rows[0]!.updated_at).getTime()) } };
  });
}

export async function deleteWorkspaceLogo(meta: { actorId: string; requestId: string; workspaceId: string }): Promise<StoredResponse> {
  return commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, meta.workspaceId);
    await tx.query('delete from public.workspace_logos where workspace_id = $1', [meta.workspaceId]);
    await audit(tx, meta.workspaceId, meta.actorId, 'workspace.logo.delete', meta.workspaceId, meta.requestId);
    return { status: 200, body: { logoVersion: null } };
  });
}

/** Image servie publiquement par identifiant d’espace (destinée à être montrée, D-022). */
export async function readWorkspaceLogo(wid: string): Promise<{ type: string; bytes: Uint8Array; updatedAt: Date } | null> {
  return systemTx(async (tx) => {
    const r = await tx.query<{ content_type: string; bytes: Uint8Array; updated_at: Date }>(
      'select content_type, bytes, updated_at from public.workspace_logos where workspace_id = $1',
      [wid],
    );
    const x = r.rows[0];
    return x ? { type: x.content_type, bytes: new Uint8Array(x.bytes), updatedAt: new Date(x.updated_at) } : null;
  });
}
