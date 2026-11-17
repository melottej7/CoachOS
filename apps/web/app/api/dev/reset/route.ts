import { NextResponse, type NextRequest } from 'next/server';
import { demoAuthEnabled } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { clearData, seed } from '@/server/db/seed';

/** Réinitialise le jeu fictif dans le processus courant (développement uniquement). */
export async function POST(req: NextRequest) {
  if (!demoAuthEnabled()) return new NextResponse(null, { status: 404 });
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== req.headers.get('host')) return new NextResponse(null, { status: 403 });
  const db = await getDb();
  await clearData(db);
  await seed(db);
  return NextResponse.redirect(new URL('/demo?reset=1', req.url), 303);
}
