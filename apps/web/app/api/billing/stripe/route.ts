import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { applyStripeEvent, type StripeEvent } from '@/server/commands/billing';
import { verifyStripeSignature } from '@/server/billing/stripe';
import { reportError } from '@/server/error-report';

/**
 * D-188 · Événements de Stripe (abonnement payé, modifié, refusé, arrêté). Pas de session : seule la signature,
 * calculée avec `STRIPE_WEBHOOK_SECRET`, prouve que l’envoi vient de Stripe. Réponse en erreur = Stripe renverra plus tard.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  const body = await req.text();
  if (body.length > 512_000) return NextResponse.json({ error: 'trop volumineux' }, { status: 413 });
  if (!secret || !verifyStripeSignature(body, req.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'signature' }, { status: 400 });
  }
  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'illisible' }, { status: 400 });
  }
  const requestId = randomUUID();
  try {
    const result = await applyStripeEvent(event);
    console.info(JSON.stringify({ reqId: requestId, module: 'billing', code: 'STRIPE_EVENT', type: event.type, result }));
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error(JSON.stringify({ reqId: requestId, module: 'billing', code: 'STRIPE_EVENT_FAILED', type: event.type }));
    await reportError(error, { module: 'billing', code: 'STRIPE_EVENT_FAILED', requestId });
    return NextResponse.json({ error: 'temporaire' }, { status: 500 });
  }
}
