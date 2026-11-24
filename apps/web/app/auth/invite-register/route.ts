import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { logAuth, sameOrigin } from '@/server/auth/forms';
import { acceptInvitation, registerFromInvitation } from '@/server/commands/invitations';
import { AppError } from '@/server/errors';
import { errorPayload } from '@/server/http';
import { clientIp, overLimit, rateLimited } from '@/server/rate-limit';
import { createConfirmedUser } from '@/server/supabase/admin';
import { supabaseConfigured, supabaseServer } from '@/server/supabase/server';

/**
 * Création du compte athlète depuis l’invitation, connexion, puis acceptation (D-020).
 * Hors contrat OpenAPI : l’inscription relève de Supabase Auth ; la réponse suit acceptInvitation.
 */
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  if (!supabaseConfigured()) return new NextResponse(null, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json(errorPayload(new AppError('ACTION_FORBIDDEN_OR_FEATURE_DISABLED', 'Origine de la requête refusée.'), requestId), { status: 403 });
  try {
    // D-162 : 10 comptes élèves par heure et par connexion internet (la création passe par l’administration, hors limites de Supabase).
    const wait = await overLimit('invite.ip', clientIp(req));
    if (wait) throw rateLimited(wait);
    const body: unknown = await req.json().catch(() => null);
    const reg = await registerFromInvitation(body, createConfirmedUser);
    const { error } = await (await supabaseServer()).auth.signInWithPassword({ email: reg.email, password: reg.password });
    if (error) {
      logAuth(error.code ?? 'signin_after_register_failed', error.status);
      throw new AppError('TEMPORARILY_UNAVAILABLE', 'Compte créé, mais la connexion a échoué. Connecte-toi avec ton adresse et ton mot de passe.');
    }
    const accepted = await acceptInvitation({ actorId: reg.userId, idempotencyKey: randomUUID(), requestId }, { token: reg.token });
    return NextResponse.json(accepted.body, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      const retry = error.code === 'RATE_LIMITED' ? { 'retry-after': String(error.details?.retryAfter ?? 60) } : undefined;
      return NextResponse.json(errorPayload(error, requestId), { status: error.status, headers: retry });
    }
    console.error(JSON.stringify({ reqId: requestId, module: 'auth', code: 'UNEXPECTED' }));
    return NextResponse.json(errorPayload(new AppError('TEMPORARILY_UNAVAILABLE', 'Service momentanément indisponible. Réessaie.'), requestId), { status: 503 });
  }
}
