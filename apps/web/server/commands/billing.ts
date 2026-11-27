import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { commandAs, systemTx, type Tx } from '../db/client';
import { AppError, conflict, invalid, notVisible } from '../errors';
import { offers, paymentsReady, type OfferId, type SubscriptionStatus } from '../offers';
import { createCheckoutSession, createPortalSession } from '../billing/stripe';
import type { StoredResponse } from './idempotency';

/**
 * D-188 · Abonnement de l’espace, en mode test derrière l’interrupteur. Seul le propriétaire de l’espace choisit une offre
 * et gère son abonnement ; Stripe tient la carte et les factures, CoachOS ne voit jamais un numéro de carte.
 * L’état de l’abonnement arrive par les événements signés de Stripe (`applyStripeEvent`), jamais par le navigateur.
 */

interface Meta { actorId: string; idempotencyKey: string; requestId: string; workspaceId: string; origin: string }

const closed = () => new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Le paiement n’est pas encore ouvert. Rien ne change pour ton espace en attendant.');

async function requireOwner(tx: Tx, wid: string) {
  const r = await tx.query<{ role: string }>('select role from public.memberships where workspace_id = $1 and user_id = auth.uid()', [wid]);
  if (r.rows[0]?.role !== 'owner') throw notVisible();
}

const backTo = (origin: string, wid: string, notice: string) => `${origin}/coach/${wid}/settings?onglet=abonnement&abonnement=${notice}`;

const checkoutSchema = z.object({ offer: z.enum(['starter', 'pro', 'elite']) }).strict();

/** startCheckout · O : page de paiement Stripe pour l’offre choisie ; un abonnement en cours se gère depuis le portail. */
export async function startCheckout(meta: Meta, body: unknown): Promise<StoredResponse> {
  const p = checkoutSchema.safeParse(body);
  if (!p.success) throw invalid([{ path: 'offer', rule: 'Offre inconnue' }]);
  const wid = meta.workspaceId;
  const billing = await commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    const r = await tx.query<{ stripe_customer_id: string | null; status: SubscriptionStatus | null }>(
      'select stripe_customer_id, status from public.workspace_billing where workspace_id = $1', [wid]);
    return r.rows[0] ?? null;
  });
  if (!paymentsReady()) throw closed();
  if (billing?.status && ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(billing.status)) {
    throw conflict('Ton abonnement est déjà en place : change d’offre ou de carte depuis « Gérer mon abonnement ».');
  }
  const offer = offers().find((o) => o.id === (p.data.offer as OfferId))!;
  const s = await createCheckoutSession({
    workspaceId: wid, offer, customerId: billing?.stripe_customer_id ?? null, email: null,
    successUrl: backTo(meta.origin, wid, 'merci'), cancelUrl: backTo(meta.origin, wid, 'annule'),
    idempotencyKey: meta.idempotencyKey,
  });
  return { status: 200, body: { url: s.url } };
}

/** openBillingPortal · O : portail client de Stripe (carte, factures, offre, arrêt). */
export async function openBillingPortal(meta: Meta): Promise<StoredResponse> {
  const wid = meta.workspaceId;
  const customer = await commandAs(meta.actorId, async (tx) => {
    await requireOwner(tx, wid);
    const r = await tx.query<{ stripe_customer_id: string | null }>('select stripe_customer_id from public.workspace_billing where workspace_id = $1', [wid]);
    return r.rows[0]?.stripe_customer_id ?? null;
  });
  if (!paymentsReady()) throw closed();
  if (!customer) throw conflict('Aucun abonnement pour l’instant : choisis d’abord une offre.');
  const s = await createPortalSession(customer, backTo(meta.origin, wid, 'portail'));
  return { status: 200, body: { url: s.url } };
}

// ---------- Événements de Stripe ----------

const OFFER_IDS = new Set(['starter', 'pro', 'elite']);
const STATUSES = new Set(['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused']);
const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
const idOf = (x: unknown, prefix: string) => (typeof x === 'string' && x.startsWith(prefix) ? x : x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string' ? (x as { id: string }).id : null);

export interface StripeEvent { id: string; type: string; data: { object: Record<string, unknown> } }

/** L’espace concerné : d’après les métadonnées posées au paiement, sinon d’après le client Stripe déjà connu. */
async function workspaceFor(tx: Tx, o: Record<string, unknown>): Promise<string | null> {
  const meta = (o.metadata ?? {}) as Record<string, unknown>;
  const candidate = isUuid(meta.workspace_id) ? meta.workspace_id : isUuid(o.client_reference_id) ? o.client_reference_id : null;
  if (candidate) {
    const ws = await tx.query('select 1 from public.workspaces where id = $1', [candidate]);
    if (ws.rows[0]) return candidate;
  }
  const customer = idOf(o.customer, 'cus_');
  if (!customer) return null;
  const r = await tx.query<{ workspace_id: string }>('select workspace_id from public.workspace_billing where stripe_customer_id = $1', [customer]);
  return r.rows[0]?.workspace_id ?? null;
}

/**
 * Applique un événement de Stripe, une seule fois (journal `billing_events`). Événements utiles : paiement terminé,
 * abonnement créé, modifié ou arrêté, facture refusée ou payée. Les autres sont notés et ignorés.
 */
export async function applyStripeEvent(ev: StripeEvent, now: Date = new Date()): Promise<'done' | 'duplicate' | 'ignored'> {
  if (!/^evt_[A-Za-z0-9]+$/.test(ev.id) || typeof ev.type !== 'string') throw invalid([{ path: 'event', rule: 'Événement illisible' }]);
  return systemTx(async (tx) => {
    const o = ev.data?.object ?? {};
    const wid = await workspaceFor(tx, o);
    const fresh = await tx.query('insert into public.billing_events(id, type, workspace_id) values ($1, $2, $3) on conflict (id) do nothing returning id', [ev.id, ev.type.slice(0, 80), wid]);
    if (!fresh.rows[0]) return 'duplicate';
    if (!wid) return 'ignored';
    const ensure = () => tx.query('insert into public.workspace_billing(workspace_id) values ($1) on conflict (workspace_id) do nothing', [wid]);
    const customer = idOf(o.customer, 'cus_');
    switch (ev.type) {
      case 'checkout.session.completed': {
        const sub = idOf(o.subscription, 'sub_');
        const offer = ((o.metadata ?? {}) as Record<string, unknown>).offer;
        await ensure();
        await tx.query(
          `update public.workspace_billing set stripe_customer_id = coalesce($2, stripe_customer_id), subscription_id = coalesce($3, subscription_id),
             status = coalesce(status, 'active'), updated_at = now() where workspace_id = $1`, [wid, customer, sub]);
        if (typeof offer === 'string' && OFFER_IDS.has(offer)) await tx.query('update public.workspaces set plan = $2 where id = $1', [wid, offer]);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const status = ev.type === 'customer.subscription.deleted' ? 'canceled' : String(o.status ?? '');
        if (!STATUSES.has(status)) return 'ignored';
        const periodEnd = typeof o.current_period_end === 'number' ? new Date(o.current_period_end * 1000) : null;
        const offer = ((o.metadata ?? {}) as Record<string, unknown>).offer;
        await ensure();
        await tx.query(
          `update public.workspace_billing set stripe_customer_id = coalesce($2, stripe_customer_id), subscription_id = coalesce($3, subscription_id),
             status = $4, current_period_end = coalesce($5, current_period_end),
             past_due_since = case when $4 in ('past_due', 'unpaid') then coalesce(past_due_since, $6) else null end, updated_at = now()
           where workspace_id = $1`,
          [wid, customer, idOf(o.id, 'sub_'), status, periodEnd, now]);
        if (status !== 'canceled' && typeof offer === 'string' && OFFER_IDS.has(offer)) await tx.query('update public.workspaces set plan = $2 where id = $1', [wid, offer]);
        break;
      }
      case 'invoice.payment_failed':
        await ensure();
        await tx.query(`update public.workspace_billing set past_due_since = coalesce(past_due_since, $2),
          status = case when status in ('active', 'trialing') then 'past_due' else status end, updated_at = now() where workspace_id = $1`, [wid, now]);
        break;
      case 'invoice.paid':
        await ensure();
        await tx.query(`update public.workspace_billing set past_due_since = null,
          status = case when status in ('past_due', 'unpaid', 'incomplete') then 'active' else status end, updated_at = now() where workspace_id = $1`, [wid]);
        break;
      default:
        return 'ignored';
    }
    // Journal : l’événement Stripe lui-même est dans `billing_events` ; ici, sa trace dans l’espace, sans auteur.
    await tx.query('insert into public.audit_logs(workspace_id, actor_id, action, target_id, request_id) values ($1, null, $2, $1, $3)', [wid, `billing.${ev.type}`.slice(0, 60), randomUUID()]);
    return 'done';
  });
}
