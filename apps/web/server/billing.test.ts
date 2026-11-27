import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { openDatabase, setDb, type Db } from './db/client';
import { USERS, WORKSPACE_A, WORKSPACE_B } from './db/fixtures';
import { AppError } from './errors';
import { applyStripeEvent, openBillingPortal, startCheckout } from './commands/billing';
import { assertWritable, readWorkspaceOffer, READ_ONLY, workspaceAlert } from './commands/workspace-offer';
import { formEncode, setStripeFetch, signStripePayload, verifyStripeSignature } from './billing/stripe';
import { readOnly, standing } from './offers';
import { POST as webhook } from '../app/api/billing/stripe/route';

// D-188 · Abonnement Stripe en mode test, derrière l’interrupteur : droits, page de paiement, événements signés, grâce,
// lecture seule. Stripe est simulé (aucun appel réseau).

let db: Db;
const ORIGIN = 'http://localhost:3000';
const SECRET = 'whsec_essai';
const meta = (actorId: string, workspaceId = WORKSPACE_A) => ({ actorId, idempotencyKey: randomUUID(), requestId: randomUUID(), workspaceId, origin: ORIGIN });
async function codeOf(p: Promise<unknown>) {
  try { await p; return 'OK'; } catch (e) { if (e instanceof AppError) return e.code; throw e; }
}
const on = () => { vi.stubEnv('COACHOS_BILLING', '1'); vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_essai'); };
let sent: { url: string; body: URLSearchParams; headers: Record<string, string> }[] = [];
const ev = (type: string, object: Record<string, unknown>) => ({ id: `evt_${randomUUID().replace(/-/g, '')}`, type, data: { object } });
const DAY = 86_400_000;

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  setStripeFetch((async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), body: new URLSearchParams(String(init.body)), headers: init.headers as Record<string, string> });
    const path = String(url);
    if (path.endsWith('/v1/checkout/sessions')) return new Response(JSON.stringify({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 });
    if (path.endsWith('/v1/billing_portal/sessions')) return new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/session/test_1' }), { status: 200 });
    return new Response(JSON.stringify({ error: { message: 'inconnu' } }), { status: 404 });
  }) as typeof fetch);
});
afterEach(() => { vi.unstubAllEnvs(); sent = []; });

describe('abonnement en mode test (D-188)', () => {
  it('écrit les paramètres comme Stripe les attend et vérifie leurs signatures', () => {
    expect(formEncode({ mode: 'subscription', line_items: [{ quantity: 1, price_data: { unit_amount: 5900 } }], meta: { a: 'b' }, nul: null }).join('&'))
      .toBe('mode=subscription&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=5900&meta%5Ba%5D=b');
    const body = '{"id":"evt_1"}';
    const header = signStripePayload(body, SECRET);
    expect(verifyStripeSignature(body, header, SECRET)).toBe(true);
    expect(verifyStripeSignature(body, header, 'whsec_autre')).toBe(false);
    expect(verifyStripeSignature(`${body} `, header, SECRET)).toBe(false);
    expect(verifyStripeSignature(body, signStripePayload(body, SECRET, Math.floor(Date.now() / 1000) - 600), SECRET)).toBe(false);
    expect(verifyStripeSignature(body, null, SECRET)).toBe(false);
  });

  it('page de paiement : propriétaire seulement, paiement ouvert seulement, prix et espace transmis', async () => {
    expect(await codeOf(startCheckout(meta(USERS.marine), { offer: 'pro' }))).toBe('ACTION_FORBIDDEN_OR_FEATURE_DISABLED'); // interrupteur éteint
    on();
    expect(await codeOf(startCheckout(meta(USERS.camille), { offer: 'pro' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(startCheckout(meta(USERS.hugo), { offer: 'pro' }))).toBe('RESOURCE_NOT_VISIBLE');
    expect(await codeOf(startCheckout(meta(USERS.marine), { offer: 'gratuit' }))).toBe('INVALID_FIELDS');
    const r = await startCheckout(meta(USERS.marine), { offer: 'pro' });
    expect(r.body).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    const b = sent[0]!.body;
    expect(sent[0]!.headers.authorization).toBe('Bearer sk_test_essai');
    expect(b.get('mode')).toBe('subscription');
    expect(b.get('line_items[0][price_data][unit_amount]')).toBe('5900');
    expect(b.get('line_items[0][price_data][currency]')).toBe('eur');
    expect(b.get('metadata[workspace_id]')).toBe(WORKSPACE_A);
    expect(b.get('subscription_data[metadata][offer]')).toBe('pro');
    expect(b.get('success_url')).toBe(`${ORIGIN}/coach/${WORKSPACE_A}/settings?onglet=abonnement&abonnement=merci`);
    expect(await codeOf(openBillingPortal(meta(USERS.marine)))).toBe('CONFLICT_OR_QUOTA'); // aucun client Stripe encore
  });

  it('événements signés : payé, refusé (14 jours de grâce), impayé (lecture seule), réglé, arrêté ; chacun traité une fois', async () => {
    on();
    const now = new Date();
    const paid = ev('checkout.session.completed', { client_reference_id: WORKSPACE_A, customer: 'cus_A1', subscription: 'sub_A1', metadata: { workspace_id: WORKSPACE_A, offer: 'starter' } });
    expect(await applyStripeEvent(paid, now)).toBe('done');
    expect(await applyStripeEvent(paid, now)).toBe('duplicate');
    let view = await readWorkspaceOffer(USERS.marine, WORKSPACE_A, now);
    expect(view.standing).toMatchObject({ kind: 'plan', offer: { id: 'starter' } });
    expect(view.hasCustomer).toBe(true);
    expect((await openBillingPortal(meta(USERS.marine))).body).toEqual({ url: 'https://billing.stripe.com/p/session/test_1' });
    expect(sent.at(-1)!.body.get('customer')).toBe('cus_A1');
    // Le navigateur ne peut rien rejouer : un abonnement en cours se gère au portail.
    expect(await codeOf(startCheckout(meta(USERS.marine), { offer: 'elite' }))).toBe('CONFLICT_OR_QUOTA');

    // Paiement refusé : tout marche pendant 14 jours, le coach est prévenu ; l’élève, non.
    await applyStripeEvent(ev('customer.subscription.updated', { id: 'sub_A1', customer: 'cus_A1', status: 'past_due', current_period_end: Math.floor(now.getTime() / 1000), metadata: { workspace_id: WORKSPACE_A, offer: 'starter' } }), now);
    view = await readWorkspaceOffer(USERS.marine, WORKSPACE_A, now);
    expect(view.standing).toMatchObject({ kind: 'grace', daysLeft: 14 });
    expect(view.readOnly).toBe(false);
    expect(await codeOf(assertWritable(USERS.marine, WORKSPACE_A, 'library', now))).toBe('OK');
    expect((await workspaceAlert(USERS.marine, WORKSPACE_A, now))?.kind).toBe('grace');

    // Grâce dépassée : lecture seule, sauf l’export, l’abonnement et les notifications.
    const later = new Date(now.getTime() + 15 * DAY);
    view = await readWorkspaceOffer(USERS.marine, WORKSPACE_A, later);
    expect(view.standing.kind).toBe('unpaid');
    expect(view.readOnly).toBe(true);
    for (const who of [USERS.marine, USERS.camille]) {
      await expect(assertWritable(who, WORKSPACE_A, 'library', later)).rejects.toThrow(READ_ONLY);
    }
    expect(await codeOf(assertWritable(USERS.marine, WORKSPACE_A, 'privacy', later))).toBe('OK');
    expect(await codeOf(assertWritable(USERS.marine, WORKSPACE_A, 'billing', later))).toBe('OK');
    expect(await codeOf(assertWritable(USERS.hugo, WORKSPACE_B, 'library', later))).toBe('OK'); // l’autre espace n’est pas touché

    // Facture payée : tout revient ; abonnement arrêté : lecture seule.
    await applyStripeEvent(ev('invoice.paid', { customer: 'cus_A1', subscription: 'sub_A1' }), later);
    expect((await readWorkspaceOffer(USERS.marine, WORKSPACE_A, later)).standing.kind).toBe('plan');
    await applyStripeEvent(ev('customer.subscription.deleted', { id: 'sub_A1', customer: 'cus_A1', status: 'canceled', metadata: {} }), later);
    view = await readWorkspaceOffer(USERS.marine, WORKSPACE_A, later);
    expect(view.standing.kind).toBe('canceled');
    expect(view.readOnly).toBe(true);
    // Sans la clé Stripe, on ne bloque personne : on ne pourrait pas payer.
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    expect(await codeOf(assertWritable(USERS.marine, WORKSPACE_A, 'library', later))).toBe('OK');
    expect(await workspaceAlert(USERS.marine, WORKSPACE_A, later)).toBeNull();
    // Un événement d’un client inconnu est noté et ignoré.
    expect(await applyStripeEvent(ev('invoice.paid', { customer: 'cus_Inconnu' }), later)).toBe('ignored');
    await db.query('delete from public.workspace_billing where workspace_id = $1', [WORKSPACE_A]);
    await db.query('update public.workspaces set plan = null where id = $1', [WORKSPACE_A]);
  });

  it('le point d’arrivée refuse ce que Stripe n’a pas signé', async () => {
    on();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET);
    const body = JSON.stringify(ev('invoice.paid', { customer: 'cus_Rien' }));
    const call = (headers: Record<string, string>) => webhook(new NextRequest('http://localhost/api/billing/stripe', { method: 'POST', body, headers }));
    expect((await call({})).status).toBe(400);
    expect((await call({ 'stripe-signature': signStripePayload(body, 'whsec_faux') })).status).toBe(400);
    const ok = await call({ 'stripe-signature': signStripePayload(body, SECRET) });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ received: true, result: 'ignored' });
  });

  it('états : grâce, impayé, arrêt ; la lecture seule exige le paiement ouvert', () => {
    const env = { COACHOS_BILLING: '1', STRIPE_SECRET_KEY: 'sk_test_x' };
    const now = new Date('2026-12-01T10:00:00Z');
    const since = new Date('2026-11-25T10:00:00Z');
    expect(standing({ plan: 'pro', trialEndsAt: null, billing: { status: 'active', pastDueSince: null, periodEnd: null } }, now, env).kind).toBe('plan');
    expect(standing({ plan: 'pro', trialEndsAt: null, billing: { status: 'past_due', pastDueSince: since, periodEnd: null } }, now, env)).toMatchObject({ kind: 'grace', daysLeft: 8 });
    const unpaid = standing({ plan: 'pro', trialEndsAt: null, billing: { status: 'unpaid', pastDueSince: new Date('2026-11-01T00:00:00Z'), periodEnd: null } }, now, env);
    expect(unpaid.kind).toBe('unpaid');
    expect(readOnly(unpaid, env)).toBe(true);
    expect(readOnly(unpaid, { COACHOS_BILLING: '1' })).toBe(false);
    const over = standing({ plan: null, trialEndsAt: new Date('2026-11-20T00:00:00Z') }, now, env);
    expect(over.kind).toBe('trial_over');
    expect(readOnly(over, env)).toBe(true);
    expect(standing({ plan: 'pro', trialEndsAt: null }, now, {}).kind).toBe('pilot');
  });
});
