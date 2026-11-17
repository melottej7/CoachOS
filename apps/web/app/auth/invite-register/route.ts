import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { logAuth, sameOrigin } from '@/server/auth/forms';
import { acceptInvitation, registerFromInvitation } from '@/server/commands/invitations';
import { AppError } from '@/server/errors';
import { errorPayload } from '@/server/http';
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
    if (error instanceof AppError) return NextResponse.json(errorPayload(error, requestId), { status: error.status });
    console.error(JSON.stringify({ reqId: requestId, module: 'auth', code: 'UNEXPECTED' }));
    return NextResponse.json(errorPayload(new AppError('TEMPORARILY_UNAVAILABLE', 'Service momentanément indisponible. Réessaie.'), requestId), { status: 503 });
  }
}
