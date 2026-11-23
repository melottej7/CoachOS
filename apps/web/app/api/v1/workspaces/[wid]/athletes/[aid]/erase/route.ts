import type { NextRequest } from 'next/server';
import { eraseAthleteData, type DeleteAuthUser } from '@/server/commands/privacy';
import { handleMutation } from '@/server/http';
import { supabaseAdmin } from '@/server/supabase/admin';
import { supabaseConfigured } from '@/server/supabase/server';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** Compte Auth supprimé seulement quand Supabase est configuré ; en démonstration (PGlite), il n’y a pas de compte Auth. */
const deleteAuthUser: DeleteAuthUser = async (userId) => {
  if (!supabaseConfigured()) return;
  const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
  if (error) throw error;
};

/** eraseAthleteData · O · effacement définitif du dossier d’un élève, et de son compte s’il n’a plus d’espace (D-115). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'privacy', (ctx) => eraseAthleteData({ ...ctx, workspaceId: p.wid, athleteId: p.aid }, deleteAuthUser));
}
