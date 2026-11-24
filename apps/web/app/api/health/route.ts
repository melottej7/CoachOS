import { NextResponse } from 'next/server';
import { getDb, usingPostgres } from '@/server/db/client';
import { aiSource } from '@/server/commands/ai';
import { pushConfigured } from '@/server/commands/push';
import { errorReportingEnabled } from '@/server/error-report';

export const dynamic = 'force-dynamic';

/** D-119 · État des services réglés sur ce serveur, sans aucun secret : ce qui est branché, pas les clés. */
function services() {
  const email = process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? 'resend' : process.env.MAILPIT_URL && process.env.NODE_ENV !== 'production' ? 'mailpit' : 'none';
  return { email, push: pushConfigured(), ai: aiSource(), contact: Boolean((process.env.COACHOS_CONTACT_EMAIL ?? '').includes('@')), errors: errorReportingEnabled() };
}

/**
 * D-114 · Contrôle de santé : l’app répond et la base est joignable. Public, sans détail sensible : seul un code
 * court est renvoyé (code d’erreur PostgreSQL ou réseau), jamais l’adresse ni le message complet.
 */
export async function GET() {
  const headers = { 'cache-control': 'no-store' };
  if (process.env.NODE_ENV === 'production' && !usingPostgres()) {
    return NextResponse.json({ ok: false, db: 'NO_DATABASE_URL', services: services() }, { status: 503, headers });
  }
  try {
    const db = await getDb();
    await Promise.race([
      db.query('select 1'),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })), 8000)),
    ]);
    return NextResponse.json({ ok: true, db: 'ok', services: services() }, { status: 200, headers });
  } catch (error) {
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : 'UNKNOWN';
    console.error(JSON.stringify({ module: 'health', code }));
    return NextResponse.json({ ok: false, db: code.slice(0, 20), services: services() }, { status: 503, headers });
  }
}
