import type { NextRequest } from 'next/server';
import { AI_IMPORT_MAX_BYTES } from '@coachos/domain';
import { transcribeProgramDocument } from '@/server/commands/ai-library';
import { handleBinaryMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** Lecture d’un document par l’IA : jusqu’à une minute. */
export const maxDuration = 60;

/** transcribeProgramDocument · C · photo ou PDF (corps binaire, 4 Mo au plus) → texte pour l’import ; rien n’est importé ni conservé (IA-5, D-193). */
export async function POST(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleBinaryMutation(req, p, 'ai', AI_IMPORT_MAX_BYTES, (ctx) => transcribeProgramDocument({ ...ctx, workspaceId: p.wid }, ctx.bytes),
    { path: 'file', rule: 'Fichier trop lourd (4 Mo au plus) : photographie une page à la fois' });
}
