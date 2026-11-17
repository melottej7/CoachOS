import type { NextRequest } from 'next/server';
import { updateMe } from '@/server/commands/profile';
import { handleMutation } from '@/server/http';

/** updateMe · U · nom d’affichage et langue. */
export async function PATCH(req: NextRequest) {
  return handleMutation(req, {}, 'auth', (ctx) => updateMe(ctx, ctx.body));
}
