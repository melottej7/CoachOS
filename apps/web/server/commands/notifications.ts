import {
  EMAIL_KINDS, EMAIL_WINDOW_HOURS, notificationEmail, notificationSettingsSchema, notificationText, parseWith, PUSH_KINDS,
  type EmailPreference, type NotificationKind, type NotificationRole,
} from '@coachos/domain';
import { commandAs, readAs, systemTx, type Tx } from '../db/client';
import { invalid, notVisible } from '../errors';
import { sendEmail } from '../email/send';
import { audit, idempotent, type StoredResponse } from './idempotency';

/**
 * Notifications (D-067). Créées dans la transaction de la commande qui les cause (publication, message, retour,
 * bilan) ; les e-mails partent après la validation, hors transaction. Jamais de contenu de message.
 */

type Meta = { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string };

/** Compte de l’élève (s’il a rejoint l’espace). */
async function athleteUser(tx: Tx, wid: string, aid: string): Promise<string | null> {
  const r = await tx.query<{ user_id: string | null }>(`select user_id from public.athletes where workspace_id = $1 and id = $2 and state = 'active'`, [wid, aid]);
  return r.rows[0]?.user_id ?? null;
}

/** D-118 : au moins un appareil abonné aux rappels dans l’espace. */
async function hasPushDevice(tx: Tx, wid: string, userId: string): Promise<boolean> {
  const r = await tx.query('select 1 from public.push_subscriptions where workspace_id = $1 and user_id = $2 limit 1', [wid, userId]);
  return r.rows.length > 0;
}

/** Coachs affectés à l’élève aujourd’hui. */
async function assignedCoaches(tx: Tx, wid: string, aid: string): Promise<string[]> {
  const r = await tx.query<{ coach_id: string }>(
    `select coach_id from public.coach_assignments where workspace_id = $1 and athlete_id = $2 and starts_at <= now() and (ends_at is null or ends_at > now())`,
    [wid, aid],
  );
  return r.rows.map((x) => x.coach_id);
}

/**
 * Notifie l’autre partie : l’élève si l’auteur est un coach, ses coachs si l’auteur est l’élève.
 * Jamais l’auteur lui-même. Regroupement : une notification non lue du même type pour le même élève est
 * remontée (nombre +1) au lieu d’en créer une autre (C25-07).
 */
export async function notify(tx: Tx, n: { wid: string; aid: string; kind: NotificationKind; entityId: string; count?: number; to: 'athlete' | 'coaches' | 'other' }) {
  const me = (await tx.query<{ id: string | null }>('select auth.uid() as id')).rows[0]?.id ?? null;
  const athlete = await athleteUser(tx, n.wid, n.aid);
  const coaches = await assignedCoaches(tx, n.wid, n.aid);
  const recipients: { user: string; role: NotificationRole }[] =
    n.to === 'athlete' ? (athlete ? [{ user: athlete, role: 'athlete' }] : [])
      : n.to === 'coaches' ? coaches.map((c) => ({ user: c, role: 'coach' as const }))
        : me && me === athlete ? coaches.map((c) => ({ user: c, role: 'coach' as const })) : athlete ? [{ user: athlete, role: 'athlete' }] : [];
  for (const r of recipients) {
    if (r.user === me) continue;
    const open = await tx.query<{ id: string }>(
      `update public.notifications set item_count = least(1000, item_count + $5), entity_id = $6, created_at = now()
       where workspace_id = $1 and user_id = $2 and kind = $3 and athlete_id = $4 and read_at is null returning id`,
      [n.wid, r.user, n.kind, n.aid, n.count ?? 1, n.entityId],
    );
    if (open.rows.length) continue;
    const pref = await tx.query<{ email: EmailPreference }>('select email from public.notification_settings where workspace_id = $1 and user_id = $2', [n.wid, r.user]);
    const wantsEmail = (pref.rows[0]?.email ?? 'essentials') === 'essentials' && EMAIL_KINDS[r.role].includes(n.kind);
    let state: 'none' | 'pending' | 'skipped' = wantsEmail ? 'pending' : 'none';
    if (wantsEmail) {
      const recent = await tx.query(
        `select 1 from public.notifications where workspace_id = $1 and user_id = $2 and kind = $3 and email_state in ('pending','sent')
           and created_at > now() - make_interval(hours => $4) limit 1`,
        [n.wid, r.user, n.kind, EMAIL_WINDOW_HOURS],
      );
      if (recent.rows.length) state = 'skipped';
    }
    // D-118 : rappel push à la création seulement (une notification non lue regroupe les suivantes), si un appareil est abonné.
    const push = PUSH_KINDS[r.role].includes(n.kind) && (await hasPushDevice(tx, n.wid, r.user)) ? 'pending' : 'none';
    await tx.query(
      `insert into public.notifications(workspace_id, user_id, kind, entity_id, athlete_id, item_count, email_state, push_state) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [n.wid, r.user, n.kind, n.entityId, n.aid, n.count ?? 1, state, push],
    );
  }
}

/**
 * D-076 : message dans un fil de groupe → les élèves membres (avec un compte) et les coachs de l’espace, sauf l’auteur.
 * Regroupé tant que non lu (« 3 nouveaux messages »), sans e-mail.
 */
export async function notifyTeam(tx: Tx, wid: string, tid: string, messageId: string) {
  const me = (await tx.query<{ id: string | null }>('select auth.uid() as id')).rows[0]?.id ?? null;
  const r = await tx.query<{ user_id: string }>(
    `select a.user_id from public.team_athletes ta join public.athletes a on a.workspace_id = ta.workspace_id and a.id = ta.athlete_id
     where ta.workspace_id = $1 and ta.team_id = $2 and a.state = 'active' and a.user_id is not null
     union
     select m.user_id from public.memberships m where m.workspace_id = $1 and m.active`,
    [wid, tid],
  );
  for (const { user_id: user } of r.rows) {
    if (user === me) continue;
    const open = await tx.query(
      `update public.notifications set item_count = least(1000, item_count + 1), entity_id = $4, created_at = now()
       where workspace_id = $1 and user_id = $2 and kind = 'group_message' and team_id = $3 and read_at is null returning id`,
      [wid, user, tid, messageId],
    );
    if (open.rows.length) continue;
    const push = (await hasPushDevice(tx, wid, user)) ? 'pending' : 'none';
    await tx.query(
      `insert into public.notifications(workspace_id, user_id, kind, entity_id, team_id, email_state, push_state) values ($1, $2, 'group_message', $3, $4, 'none', $5)`,
      [wid, user, messageId, tid, push],
    );
  }
}

/**
 * Envoie les e-mails en attente (après validation de la commande). Lien vers le résolveur, qui revérifie les droits.
 * Ne journalise ni l’adresse ni le contenu. Un échec reste « failed » et ne bloque rien.
 */
export async function flushNotificationEmails(origin: string): Promise<number> {
  const pending = await systemTx((tx) => tx.query<{
    id: string; workspace_id: string; kind: NotificationKind; item_count: number; email: string; ws_name: string; athlete_name: string | null; is_athlete: boolean;
  }>(
    `update public.notifications n set email_state = 'sent', emailed_at = now()
     from auth.users u, public.workspaces w
     where n.email_state = 'pending' and u.id = n.user_id and w.id = n.workspace_id
     returning n.id, n.workspace_id, n.kind, n.item_count, u.email, w.name as ws_name,
       (select display_name from public.athletes a where a.workspace_id = n.workspace_id and a.id = n.athlete_id) as athlete_name,
       exists (select 1 from public.athletes a where a.workspace_id = n.workspace_id and a.id = n.athlete_id and a.user_id = n.user_id) as is_athlete`,
  ));
  let sent = 0;
  for (const p of pending.rows) {
    const role: NotificationRole = p.is_athlete ? 'athlete' : 'coach';
    const m = notificationEmail(p.kind, role, { athleteName: p.athlete_name, count: p.item_count, workspaceName: p.ws_name, link: `${origin}/n/${p.workspace_id}/${p.id}` });
    try {
      await sendEmail({ to: p.email, subject: m.subject, text: m.text, html: `<p>${esc(m.text).replace(/\n/g, '<br>')}</p>` });
      sent++;
    } catch {
      await systemTx((tx) => tx.query(`update public.notifications set email_state = 'failed' where id = $1`, [p.id]));
      console.warn(JSON.stringify({ module: 'notifications', code: 'email_failed' }));
    }
  }
  return sent;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface NotificationItem { id: string; kind: NotificationKind; text: string; count: number; createdAt: string; read: boolean }

/** Centre de notifications : les miennes dans cet espace, récentes d’abord (RLS : destinataire et appartenance actuelle). */
export async function listNotifications(userId: string, wid: string, limit = 50): Promise<NotificationItem[]> {
  return readAs(userId, async (tx) => {
    const r = await tx.query<{ id: string; kind: NotificationKind; item_count: number; created_at: Date; read_at: Date | null; athlete_name: string | null; is_athlete: boolean; team_name: string | null }>(
      `select n.id, n.kind, n.item_count, n.created_at, n.read_at, a.display_name as athlete_name, (a.user_id = n.user_id) as is_athlete, tm.name as team_name
       from public.notifications n left join public.athletes a on a.workspace_id = n.workspace_id and a.id = n.athlete_id
       left join public.teams tm on tm.workspace_id = n.workspace_id and tm.id = n.team_id
       where n.workspace_id = $1 order by n.created_at desc, n.id limit $2`,
      [wid, limit],
    );
    return r.rows.map((x) => ({
      id: x.id, kind: x.kind, count: x.item_count, createdAt: new Date(x.created_at).toISOString(), read: x.read_at !== null,
      text: notificationText(x.kind, x.is_athlete ? 'athlete' : 'coach', { athleteName: x.athlete_name, count: x.item_count, teamName: x.team_name }),
    }));
  });
}

export async function unreadNotificationCount(userId: string, wid: string): Promise<number> {
  return readAs(userId, async (tx) => (await tx.query<{ n: number }>('select count(*)::int as n from public.notifications where workspace_id = $1 and read_at is null', [wid])).rows[0]?.n ?? 0);
}

/**
 * Ouvre une notification (C25-09) : la marque lue et donne l’écran utile, après contrôle des droits actuels.
 * null : l’accès a été retiré (affectation terminée, élève archivé, séance retirée).
 */
export async function resolveNotification(userId: string, wid: string, nid: string): Promise<{ href: string | null } | null> {
  const n = await readAs(userId, async (tx) => (await tx.query<{ kind: NotificationKind; entity_id: string | null; athlete_id: string | null; team_id: string | null }>(
    'select kind, entity_id, athlete_id, team_id from public.notifications where workspace_id = $1 and id = $2', [wid, nid])).rows[0] ?? null);
  if (!n) return null;
  await commandAs(userId, (tx) => tx.query('update public.notifications set read_at = coalesce(read_at, now()) where workspace_id = $1 and id = $2 and user_id = auth.uid()', [wid, nid]));
  const href = await readAs(userId, async (tx) => {
    if (n.kind === 'group_message') {
      if (!n.team_id) return null;
      const w = await tx.query<{ member: boolean; coach: boolean }>('select private.team_member($1, $2) as member, private.current_coach($1) as coach', [wid, n.team_id]);
      const x = w.rows[0];
      return x?.member ? `/athlete/${wid}/messages/groupe/${n.team_id}` : x?.coach ? `/coach/${wid}/messages/groupe/${n.team_id}` : null;
    }
    const aid = n.athlete_id;
    if (!aid) return null;
    const who = await tx.query<{ own: boolean; assigned: boolean }>('select private.own_athlete($1, $2) as own, private.assigned($1, $2) as assigned', [wid, aid]);
    const { own, assigned } = who.rows[0] ?? { own: false, assigned: false };
    switch (n.kind) {
      case 'workouts_published': {
        if (!own) return null;
        const w = await tx.query('select 1 from public.workouts where workspace_id = $1 and athlete_id = $2 and id = $3 and published_revision is not null', [wid, aid, n.entity_id]);
        return w.rows.length ? `/athlete/${wid}/workouts/${n.entity_id}` : `/athlete/${wid}/schedule`;
      }
      case 'message': return own ? `/athlete/${wid}/messages/coach` : assigned ? `/coach/${wid}/messages/${aid}` : null;
      case 'feedback': {
        if (!assigned) return null;
        const r = await tx.query<{ id: string }>(
          `select ri.id from public.review_items ri join public.feedbacks f on f.workspace_id = ri.workspace_id and f.id::text = ri.source_ref::text
           join public.workout_results res on res.workspace_id = f.workspace_id and res.id = f.result_id
           where ri.workspace_id = $1 and ri.kind = 'feedback' and res.workout_id = $2`,
          [wid, n.entity_id],
        );
        return r.rows[0] ? `/coach/${wid}/review/${r.rows[0].id}` : `/coach/${wid}/athletes/${aid}`;
      }
      case 'bilan_submitted': return assigned ? `/coach/${wid}/athletes/${aid}#bilan` : null;
    }
  });
  return { href };
}

/** markAllNotificationsRead · CA : tout marquer lu dans cet espace. */
export async function markAllNotificationsRead(meta: Meta): Promise<StoredResponse> {
  return commandAs(meta.actorId, async (tx) => {
    const r = await tx.query('update public.notifications set read_at = now() where workspace_id = $1 and user_id = auth.uid() and read_at is null returning id', [meta.workspaceId]);
    return { status: 200, body: { read: r.rows.length } };
  });
}

/** markNotificationRead · CA : lecture répétée sans effet (docs/06_API.md). */
export async function markNotificationRead(meta: Meta & { notificationId: string }): Promise<StoredResponse> {
  return commandAs(meta.actorId, async (tx) => {
    const r = await tx.query<{ read_at: Date }>(
      'update public.notifications set read_at = coalesce(read_at, now()) where workspace_id = $1 and id = $2 and user_id = auth.uid() returning read_at',
      [meta.workspaceId, meta.notificationId],
    );
    if (!r.rows[0]) throw notVisible();
    return { status: 200, body: { readAt: new Date(r.rows[0].read_at).toISOString() } };
  });
}

export async function readNotificationSettings(userId: string, wid: string): Promise<{ email: EmailPreference }> {
  return readAs(userId, async (tx) => ({ email: (await tx.query<{ email: EmailPreference }>('select email from public.notification_settings where workspace_id = $1 and user_id = auth.uid()', [wid])).rows[0]?.email ?? 'essentials' }));
}

/** saveNotificationSettings · CA : réglage des e-mails pour cet espace (membre actuel seulement). */
export async function saveNotificationSettings(meta: Meta, body: unknown): Promise<StoredResponse> {
  const p = parseWith(notificationSettingsSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as { email: EmailPreference };
  return commandAs(meta.actorId, async (tx) => {
    const m = await tx.query<{ ok: boolean }>('select (private.current_coach($1) or private.current_athlete($1)) as ok', [meta.workspaceId]);
    if (!m.rows[0]?.ok) throw notVisible();
    return idempotent(tx, { workspaceId: meta.workspaceId, actorId: meta.actorId, action: 'notifications.settings', key: meta.idempotencyKey, body }, async () => {
      await tx.query(
        `insert into public.notification_settings(workspace_id, user_id, email) values ($1, auth.uid(), $2)
         on conflict (workspace_id, user_id) do update set email = excluded.email, updated_at = now()`,
        [meta.workspaceId, v.email],
      );
      await audit(tx, meta.workspaceId, meta.actorId, 'notifications.settings', meta.actorId, meta.requestId);
      return { status: 200, body: { email: v.email } };
    });
  });
}
