import type { NextRequest } from 'next/server';
import { archiveAthlete, restoreAthlete } from '@/server/commands/portfolio';
import { handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string; aid: string }> };

/** archiveAthlete · O · retirer l’élève de l’espace, sans rien effacer (bilan produit). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => archiveAthlete({ ...ctx, workspaceId: p.wid, athleteId: p.aid }));
}

/** restoreAthlete · O · « Annuler » ou « Rétablir » : l’élève retrouve son état d’avant. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'roster', (ctx) => restoreAthlete({ ...ctx, workspaceId: p.wid, athleteId: p.aid }));
}
