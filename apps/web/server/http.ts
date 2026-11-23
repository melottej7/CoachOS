import { flushNotificationEmails } from './commands/notifications';
import { flushPushNotifications } from './commands/push';
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

/** Corps d’erreur du contrat (errorBody). error.details reste côté serveur : aucune propriété supplémentaire. */
export function errorPayload(error: AppError, requestId: string) {
  return { error: { code: error.code, message: error.message, requestId, fields: error.fields } };
}

function errorResponse(error: AppError, requestId: string) {
  return NextResponse.json(errorPayload(error, requestId), { status: error.status });
}

/** Violation d’unicité PostgreSQL (23505) : conflit métier lisible plutôt qu’une erreur 503. */
function asAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if ((error as { code?: string })?.code === '23505') {
    return new AppError('CONFLICT_OR_QUOTA', 'Cette action vient d’être faite depuis un autre appareil. Recharge la page.');
  }
  return null;
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
    // D-067 : e-mails de notification après la validation, sans retarder la réponse ni la faire échouer.
    void flushNotificationEmails(new URL(origin).origin).catch(() => undefined);
    void flushPushNotifications(new URL(origin).origin).catch(() => undefined); // D-118
    return NextResponse.json(result.body, { status: result.status, headers: { 'x-request-id': requestId } });
  } catch (error) {
    const known = asAppError(error);
    if (known) {
      code = known.code;
      return errorResponse(known, requestId);
    }
    code = 'UNEXPECTED';
    // Journal technique : reqId, module, code, durée. Jamais de corps ni de texte athlète.
    console.error(JSON.stringify({ reqId: requestId, module, code, error: (error as Error)?.name }));
    return errorResponse(new AppError('TEMPORARILY_UNAVAILABLE', 'Service momentanément indisponible. Réessaie.'), requestId);
  } finally {
    console.info(JSON.stringify({ reqId: requestId, module, code, ms: Date.now() - started }));
  }
}

/** Mutation à corps binaire (image). Mêmes contrôles d’origine et de session, taille bornée. */
export async function handleBinaryMutation(
  req: NextRequest,
  params: Record<string, string>,
  module: string,
  maxBytes: number,
  run: (ctx: { actorId: string; requestId: string; bytes: Uint8Array }) => Promise<StoredResponse>,
  tooLarge: { path: string; rule: string } = { path: 'logo', rule: 'Image trop lourde (512 Kio au plus)' },
): Promise<NextResponse> {
  const requestId = randomUUID();
  try {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (!origin || !host || new URL(origin).host !== host) throw new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Origine de la requête refusée.');
    const actor = await getActor();
    if (!actor) throw new AppError('AUTH_REQUIRED_OR_INVALID_SIGNATURE', 'Session expirée. Reconnecte-toi pour continuer.');
    if (Object.values(params).some((v) => !isUuid(v))) throw new AppError('RESOURCE_NOT_VISIBLE', 'Cette ressource n’est pas disponible.');
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > maxBytes) throw new AppError('INVALID_FIELDS', 'Certains champs sont à corriger.', [tooLarge]);
    const bytes = new Uint8Array(await req.arrayBuffer());
    const result = await run({ actorId: actor.userId, requestId, bytes });
    return NextResponse.json(result.body, { status: result.status, headers: { 'x-request-id': requestId } });
  } catch (error) {
    const known = asAppError(error);
    if (known) return errorResponse(known, requestId);
    console.error(JSON.stringify({ reqId: requestId, module, code: 'UNEXPECTED' }));
    return errorResponse(new AppError('TEMPORARILY_UNAVAILABLE', 'Service momentanément indisponible. Réessaie.'), requestId);
  }
}

/** Lecture Web à cookie : session et identifiants vérifiés, puis requête. `run` peut renvoyer une réponse complète (fichier). */
export async function handleQuery(
  _req: NextRequest,
  params: Record<string, string>,
  module: string,
  run: (ctx: { actorId: string; requestId: string }) => Promise<StoredResponse | NextResponse>,
): Promise<NextResponse> {
  const requestId = randomUUID();
  try {
    const actor = await getActor();
    if (!actor) throw new AppError('AUTH_REQUIRED_OR_INVALID_SIGNATURE', 'Session expirée. Reconnecte-toi pour continuer.');
    if (Object.values(params).some((v) => !isUuid(v))) throw new AppError('RESOURCE_NOT_VISIBLE', 'Cette ressource n’est pas disponible.');
    const result = await run({ actorId: actor.userId, requestId });
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result.body, { status: result.status, headers: { 'x-request-id': requestId, 'cache-control': 'private, no-store' } });
  } catch (error) {
    const known = asAppError(error);
    if (known) return errorResponse(known, requestId);
    console.error(JSON.stringify({ reqId: requestId, module, code: 'UNEXPECTED', error: (error as Error)?.name }));
    return errorResponse(new AppError('TEMPORARILY_UNAVAILABLE', 'Service momentanément indisponible. Réessaie.'), requestId);
  }
}
