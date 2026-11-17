import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getActor } from './auth/session';
import type { StoredResponse } from './commands/idempotency';
import { AppError } from './errors';
import { isUuid } from './repo/context';

const MAX_BODY = 64 * 1024;

export interface MutationContext {
  actorId: string;
  idempotencyKey: string;
  requestId: string;
  body: unknown;
  /** Origine vérifiée (même hôte) : sert à construire les liens envoyés par e-mail. */
  origin: string;
}

function errorResponse(error: AppError, requestId: string) {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        fields: error.fields,
        // error.details reste côté serveur : errorBody n’autorise pas de propriété supplémentaire.
      },
    },
    { status: error.status },
  );
}

/** Mutation Web à cookie : origine, session, Idempotency-Key, JSON borné, puis commande. */
export async function handleMutation(
  req: NextRequest,
  params: Record<string, string>,
  module: string,
  run: (ctx: MutationContext) => Promise<StoredResponse>,
): Promise<NextResponse> {
  const requestId = randomUUID();
  const started = Date.now();
  let code = 'OK';
  try {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (!origin || !host || new URL(origin).host !== host) {
      throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Origine de la requête refusée.');
    }
    const actor = await getActor();
    if (!actor) throw new AppError('AUTH_REQUIRED_OR_INVALID_SIGNATURE', 'Session expirée. Reconnecte-toi pour continuer.');
    if (Object.values(params).some((v) => !isUuid(v))) throw new AppError('RESOURCE_NOT_VISIBLE', 'Cette ressource n’est pas disponible.');
    const key = req.headers.get('idempotency-key') ?? '';
    if (!isUuid(key)) throw new AppError('MALFORMED_REQUEST', 'En-tête Idempotency-Key manquant ou invalide.');
    const text = await req.text();
    if (text.length > MAX_BODY) throw new AppError('MALFORMED_REQUEST', 'Requête trop volumineuse.');
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      throw new AppError('MALFORMED_REQUEST', 'Corps JSON invalide.');
    }
    const result = await run({ actorId: actor.userId, idempotencyKey: key, requestId, body, origin: new URL(origin).origin });
    return NextResponse.json(result.body, { status: result.status, headers: { 'x-request-id': requestId } });
  } catch (error) {
    if (error instanceof AppError) {
      code = error.code;
      return errorResponse(error, requestId);
    }
    code = 'UNEXPECTED';
    // Journal technique : reqId, module, code, durée. Jamais de corps ni de texte athlète.
    console.error(JSON.stringify({ reqId: requestId, module, code, error: (error as Error)?.name }));
    return errorResponse(new AppError('TEMPORARILY_UNAVAILABLE', 'Service momentanément indisponible. Réessaie.'), requestId);
  } finally {
    console.info(JSON.stringify({ reqId: requestId, module, code, ms: Date.now() - started }));
  }
}
