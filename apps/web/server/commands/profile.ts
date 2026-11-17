import { athleteSettingsSchema, parseWith, updateMeSchema } from '@coachos/domain';
import { commandAs } from '../db/client';
import { AppError, invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';

interface Meta {
  actorId: string;
  idempotencyKey: string;
  requestId: string;
}

/** PATCH /me (C02-07) : nom d’affichage et langue. Le rôle n’est jamais touché. */
export async function updateMe(meta: Meta, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(updateMeSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const { displayName, locale } = parsed.value;
  return commandAs(meta.actorId, (tx) =>
    idempotent(tx, { actorId: meta.actorId, action: 'me.update', key: meta.idempotencyKey, body }, async () => {
      const r = await tx.query<{ display_name: string; locale: 'fr' | 'en' }>(
        `update public.users set display_name = coalesce($2, display_name), locale = coalesce($3, locale)
         where id = $1 returning display_name, locale`,
        [meta.actorId, displayName, locale],
      );
      const row = r.rows[0];
      if (!row) throw new AppError('AUTH_REQUIRED_OR_INVALID_SIGNATURE', 'Session expirée. Reconnecte-toi pour continuer.');
      return { status: 200, body: { displayName: row.display_name, locale: row.locale } };
    }),
  );
}

/**
 * PATCH /workspaces/{wid}/athlete-settings : l’athlète règle le fuseau de sa relation.
 * Les séances existantes gardent leur date locale et leur fuseau d’origine (pas de redatation).
 */
export async function updateAthleteSettings(meta: Meta & { workspaceId: string }, body: unknown): Promise<StoredResponse> {
  const parsed = parseWith(athleteSettingsSchema, body);
  if (!parsed.ok) throw invalid(parsed.fields);
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `select id from public.athletes where workspace_id = $1 and user_id = auth.uid() and state = 'active' for update`,
      [wid],
    );
    const athlete = r.rows[0];
    if (!athlete) throw notVisible();
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'athlete.settings', key: meta.idempotencyKey, body }, async () => {
      await tx.query('update public.athletes set time_zone = $3 where workspace_id = $1 and id = $2', [wid, athlete.id, parsed.value.timeZone]);
      await audit(tx, wid, meta.actorId, 'athlete.settings', athlete.id, meta.requestId);
      return { status: 200, body: { timeZone: parsed.value.timeZone } };
    });
  });
}

/** Profil courant (GET /me). */
export async function readMe(userId: string): Promise<{ displayName: string; locale: 'fr' | 'en' } | null> {
  return commandAs(userId, async (tx) => {
    const r = await tx.query<{ display_name: string; locale: 'fr' | 'en' }>('select display_name, locale from public.users where id = $1', [userId]);
    return r.rows[0] ? { displayName: r.rows[0].display_name, locale: r.rows[0].locale } : null;
  });
}
