import { NextResponse, type NextRequest } from 'next/server';
import { readWorkspaceLogo } from '@/server/commands/workspace-profile';
import { isUuid } from '@/server/repo/context';

/** Logo de l’espace, servi tel quel avec des en-têtes stricts (aucun script, aucun sniffing). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  if (!isUuid(wid)) return new NextResponse(null, { status: 404 });
  const logo = await readWorkspaceLogo(wid);
  if (!logo) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(logo.bytes), {
    status: 200,
    headers: {
      'content-type': logo.type,
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      'content-disposition': 'inline',
      'last-modified': logo.updatedAt.toUTCString(),
    },
  });
}
