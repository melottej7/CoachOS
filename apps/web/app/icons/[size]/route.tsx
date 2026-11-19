import { brandIcon } from '../../brand-icon';

const SIZES: Record<string, { px: number; maskable: boolean }> = {
  '192.png': { px: 192, maskable: false }, '512.png': { px: 512, maskable: false }, 'maskable-512.png': { px: 512, maskable: true },
};

/** Icônes du manifeste (CE-E-06). */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const s = SIZES[(await params).size];
  if (!s) return new Response('Introuvable', { status: 404 });
  const res = brandIcon(s.px, s.maskable);
  res.headers.set('cache-control', 'public, max-age=86400');
  return res;
}
