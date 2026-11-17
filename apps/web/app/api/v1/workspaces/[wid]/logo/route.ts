import type { NextRequest } from 'next/server';
import { LOGO_MAX_BYTES } from '@coachos/domain';
import { deleteWorkspaceLogo, setWorkspaceLogo } from '@/server/commands/workspace-profile';
import { handleBinaryMutation, handleMutation } from '@/server/http';

type Params = { params: Promise<{ wid: string }> };

/** setWorkspaceLogo · O · corps binaire PNG, JPEG ou WebP, 512 Kio au plus. */
export async function PUT(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleBinaryMutation(req, p, 'workspace', LOGO_MAX_BYTES, (ctx) => setWorkspaceLogo({ ...ctx, workspaceId: p.wid }, ctx.bytes));
}

/** deleteWorkspaceLogo · O. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const p = await params;
  return handleMutation(req, p, 'workspace', (ctx) => deleteWorkspaceLogo({ ...ctx, workspaceId: p.wid }));
}
