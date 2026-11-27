import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * D-188 · Stripe, par son API web (formulaire encodé, clé secrète côté serveur seulement). Mode test tant que la clé est
 * une clé de test (`sk_test_…`). Rien ici ne s’exécute si l’interrupteur commercial est éteint (voir `paymentsReady`).
 * `STRIPE_API_BASE` ne sert qu’aux essais (faux Stripe local) ; par défaut, l’API de Stripe.
 */

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

let fetcher: Fetch | null = null;
/** Essais : remplace l’appel réseau vers Stripe. */
export function setStripeFetch(f: Fetch | null) { fetcher = f; }

const apiBase = (env: Env) => (env.STRIPE_API_BASE ?? 'https://api.stripe.com').replace(/\/+$/, '');

/** `{ a: { b: 1 } }` → `a[b]=1`, comme l’attend l’API de Stripe. */
export function formEncode(data: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => out.push(...(x !== null && typeof x === 'object' ? formEncode(x as Record<string, unknown>, `${key}[${i}]`) : [`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`])));
    else if (typeof v === 'object') out.push(...formEncode(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export class StripeError extends Error {
  constructor(public status: number, public code: string | null, message: string) { super(message); this.name = 'StripeError'; }
}

async function call<T>(path: string, body: Record<string, unknown>, env: Env, idempotencyKey?: string): Promise<T> {
  const key = env.STRIPE_SECRET_KEY ?? '';
  const res = await (fetcher ?? fetch)(`${apiBase(env)}/v1/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: formEncode(body).join('&'),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: { code?: string; message?: string } }) | null;
  if (!res.ok || !json) throw new StripeError(res.status, json?.error?.code ?? null, json?.error?.message ?? `Stripe ${res.status}`);
  return json;
}

export interface CheckoutInput {
  workspaceId: string;
  offer: { id: string; name: string; price: number };
  customerId: string | null;
  email: string | null;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

/**
 * Page de paiement hébergée par Stripe (abonnement mensuel, en euros, hors taxes) : le prix vient de l’offre de CoachOS,
 * sans produit à créer dans Stripe. L’espace est noté dans les métadonnées pour relier les événements à l’espace.
 */
export async function createCheckoutSession(input: CheckoutInput, env: Env = process.env): Promise<{ id: string; url: string }> {
  const meta = { workspace_id: input.workspaceId, offer: input.offer.id };
  const s = await call<{ id: string; url: string }>('checkout/sessions', {
    mode: 'subscription',
    locale: 'fr',
    client_reference_id: input.workspaceId,
    ...(input.customerId ? { customer: input.customerId } : input.email ? { customer_email: input.email } : {}),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(input.offer.price * 100),
        recurring: { interval: 'month' },
        tax_behavior: 'exclusive',
        product_data: { name: `CoachOS ${input.offer.name}` },
      },
    }],
    metadata: meta,
    subscription_data: { metadata: meta },
    allow_promotion_codes: 'true',
    billing_address_collection: 'required',
    tax_id_collection: { enabled: 'true' },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  }, env, input.idempotencyKey);
  if (!/^https:\/\//.test(s.url) && !(env.STRIPE_API_BASE && s.url.startsWith(apiBase(env)))) throw new StripeError(502, null, 'Adresse de paiement inattendue');
  return { id: s.id, url: s.url };
}

/** Portail client de Stripe : carte, factures, changement d’offre ou arrêt de l’abonnement. */
export async function createPortalSession(customerId: string, returnUrl: string, env: Env = process.env): Promise<{ url: string }> {
  const s = await call<{ url: string }>('billing_portal/sessions', { customer: customerId, return_url: returnUrl, locale: 'fr' }, env);
  return { url: s.url };
}

/**
 * Signature d’un événement envoyé par Stripe (en-tête `Stripe-Signature: t=…,v1=…`) : HMAC SHA-256 de « t.corps » avec le
 * secret du point d’arrivée, comparé en temps constant ; refusé au-delà de 5 minutes (rejeu).
 */
export function verifyStripeSignature(body: string, header: string | null, secret: string, now: number = Date.now(), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = header.split(',').map((x) => x.trim().split('='));
  const t = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
  if (!Number.isFinite(t) || !signatures.length) return false;
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${body}`).digest('hex'));
  return signatures.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), expected));
}

/** Essais : en-tête signé comme Stripe le ferait. */
export function signStripePayload(body: string, secret: string, t: number = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}
