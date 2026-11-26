import type { NextRequest } from 'next/server';
import { startCheckout } from '@/server/commands/billing';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** startCheckout · O · page de paiement Stripe pour l’offre choisie (mode test, derrière l’interrupteur, D-188). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'billing', (ctx) => startCheckout({ ...ctx, workspaceId: p.wid }, ctx.body));
}
