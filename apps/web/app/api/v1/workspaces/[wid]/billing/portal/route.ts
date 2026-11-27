import type { NextRequest } from 'next/server';
import { openBillingPortal } from '@/server/commands/billing';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** openBillingPortal · O · portail client de Stripe : carte, factures, offre, arrêt (D-188). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'billing', (ctx) => openBillingPortal({ ...ctx, workspaceId: p.wid }));
}
