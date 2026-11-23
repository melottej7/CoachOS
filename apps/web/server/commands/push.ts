import webpush from 'web-push';
import { parseWith, pushPayload, pushSubscriptionSchema, pushUnsubscribeSchema, type NotificationKind, type NotificationRole } from '@coachos/domain';
import { commandAs, readAs, systemTx } from '../db/client';
import { invalid, notVisible } from '../errors';
import { audit, idempotent, type StoredResponse } from './idempotency';

/**
 * D-118 · Rappels push. Clés VAPID du serveur (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT) ; sans elles,
 * la fonction est simplement absente de l’écran. Les envois partent après la validation de la commande, hors
 * transaction, comme les e-mails ; un appareil disparu (404, 410) est oublié ; rien n’est journalisé du contenu.
 */

type Meta = { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string };

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type PushSender = (target: PushTarget, payload: string) => Promise<void>;

const globalForPush = globalThis as unknown as { __coachosPushSender?: PushSender };

/** Tests : remplace l’envoi réel. */
export function setPushSender(sender: PushSender | undefined): void {
  globalForPush.__coachosPushSender = sender;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) || Boolean(globalForPush.__coachosPushSender);
}

/** Clé publique à donner au navigateur ; null tant que le serveur n’est pas réglé. */
export function publicVapidKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

async function send(target: PushTarget, payload: string): Promise<void> {
  const custom = globalForPush.__coachosPushSender;
  if (custom) return custom(target, payload);
  const subject = (process.env.VAPID_SUBJECT ?? '').trim() || 'mailto:contact@coachos.test';
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY!.trim(), process.env.VAPID_PRIVATE_KEY!.trim());
  await webpush.sendNotification(target, payload, { TTL: 24 * 3600, urgency: 'normal' });
}

async function requireMember(tx: Parameters<Parameters<typeof commandAs>[1]>[0], wid: string) {
  const m = await tx.query<{ ok: boolean }>('select (private.current_coach($1) or private.current_athlete($1)) as ok', [wid]);
  if (!m.rows[0]?.ok) throw notVisible();
}

/** savePushSubscription · CA : enregistre (ou rafraîchit) l’abonnement de cet appareil dans l’espace. */
export async function savePushSubscription(meta: Meta, body: unknown): Promise<StoredResponse> {
  const p = parseWith(pushSubscriptionSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as { endpoint: string; keys: { p256dh: string; auth: string } };
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireMember(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'push.subscribe', key: meta.idempotencyKey, body }, async () => {
      const r = await tx.query<{ id: string }>(
        `insert into public.push_subscriptions(workspace_id, user_id, endpoint, p256dh, auth) values ($1, auth.uid(), $2, $3, $4)
         on conflict (workspace_id, user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth returning id`,
        [wid, v.endpoint, v.keys.p256dh, v.keys.auth],
      );
      const n = await tx.query<{ n: number }>('select count(*)::int as n from public.push_subscriptions where workspace_id = $1 and user_id = auth.uid()', [wid]);
      await audit(tx, wid, meta.actorId, 'push.subscribe', r.rows[0]!.id, meta.requestId);
      return { status: 200, body: { id: r.rows[0]!.id, devices: n.rows[0]?.n ?? 1 } };
    });
  });
}

/** deletePushSubscription · CA : oublie cet appareil. Sans effet s’il n’était pas connu. */
export async function deletePushSubscription(meta: Meta, body: unknown): Promise<StoredResponse> {
  const p = parseWith(pushUnsubscribeSchema, body);
  if (!p.ok) throw invalid(p.fields);
  const v = p.value as { endpoint: string };
  const wid = meta.workspaceId;
  return commandAs(meta.actorId, async (tx) => {
    await requireMember(tx, wid);
    return idempotent(tx, { workspaceId: wid, actorId: meta.actorId, action: 'push.unsubscribe', key: meta.idempotencyKey, body }, async () => {
      const r = await tx.query('delete from public.push_subscriptions where workspace_id = $1 and user_id = auth.uid() and endpoint = $2 returning id', [wid, v.endpoint]);
      if (r.rows.length) await audit(tx, wid, meta.actorId, 'push.unsubscribe', meta.actorId, meta.requestId);
      return { status: 200, body: { removed: r.rows.length > 0 } };
    });
  });
}

/** Nombre d’appareils abonnés de la personne dans l’espace (RLS : les siens seulement). */
export async function countMyPushDevices(userId: string, wid: string): Promise<number> {
  return readAs(userId, async (tx) => (await tx.query<{ n: number }>('select count(*)::int as n from public.push_subscriptions where workspace_id = $1', [wid])).rows[0]?.n ?? 0);
}

interface PendingRow {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: NotificationKind;
  item_count: number;
  athlete_name: string | null;
  team_name: string | null;
  is_athlete: boolean;
}

/**
 * Envoie les rappels en attente (après validation de la commande). Lien vers le résolveur, qui revérifie les droits.
 * Un appareil disparu est retiré ; si aucun appareil ne reçoit, la notification reste « failed » et ne bloque rien.
 */
export async function flushPushNotifications(origin: string): Promise<number> {
  if (!pushConfigured()) return 0;
  const pending = await systemTx((tx) => tx.query<PendingRow>(
    `update public.notifications n set push_state = 'sent'
     where n.push_state = 'pending'
     returning n.id, n.workspace_id, n.user_id, n.kind, n.item_count,
       (select display_name from public.athletes a where a.workspace_id = n.workspace_id and a.id = n.athlete_id) as athlete_name,
       (select name from public.teams t where t.workspace_id = n.workspace_id and t.id = n.team_id) as team_name,
       exists (select 1 from public.athletes a where a.workspace_id = n.workspace_id and a.id = n.athlete_id and a.user_id = n.user_id) as is_athlete`,
  ));
  let delivered = 0;
  for (const p of pending.rows) {
    const role: NotificationRole = p.is_athlete ? 'athlete' : 'coach';
    const payload = JSON.stringify(pushPayload(p.kind, role, { athleteName: p.athlete_name, count: p.item_count, teamName: p.team_name, url: `${origin}/n/${p.workspace_id}/${p.id}` }));
    const targets = await systemTx((tx) => tx.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
      'select id, endpoint, p256dh, auth from public.push_subscriptions where workspace_id = $1 and user_id = $2', [p.workspace_id, p.user_id],
    ));
    let ok = 0;
    for (const t of targets.rows) {
      try {
        await send({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload);
        ok++;
        await systemTx((tx) => tx.query('update public.push_subscriptions set last_used_at = now() where workspace_id = $1 and id = $2', [p.workspace_id, t.id]));
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await systemTx((tx) => tx.query('delete from public.push_subscriptions where workspace_id = $1 and id = $2', [p.workspace_id, t.id]));
        } else {
          console.warn(JSON.stringify({ module: 'push', code: 'send_failed', status: status ?? null }));
        }
      }
    }
    if (ok) delivered++;
    else await systemTx((tx) => tx.query(`update public.notifications set push_state = 'failed' where workspace_id = $1 and id = $2`, [p.workspace_id, p.id]));
  }
  return delivered;
}
