import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { sameOrigin } from '@/server/auth/forms';
import { previewInvitation } from '@/server/commands/workspace-profile';
import { AppError } from '@/server/errors';
import { errorPayload } from '@/server/http';

/** previewInvitation · public avec jeton valable : présentation de l’espace avant la création du compte. */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    if (!sameOrigin(req)) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Origine de la requête refusée.');
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    const workspace = await previewInvitation(body?.token);
    return NextResponse.json({ workspace }, { status: 200, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const e = error instanceof AppError ? error : new AppError('TEMPORARILY_UNAVAILABLE', 'Service momentanément indisponible. Réessaie.');
    return NextResponse.json(errorPayload(e, requestId), { status: e.status });
  }
}
