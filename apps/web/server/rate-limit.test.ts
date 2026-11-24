import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { openDatabase, setDb, type Db } from './db/client';
import { clientIp, LIMITS, overLimit, waitSentence } from './rate-limit';
import { POST as login } from '../app/auth/login/route';
import { POST as forgot } from '../app/auth/forgot/route';
import { POST as signup } from '../app/auth/signup/route';
import { POST as inviteRegister } from '../app/auth/invite-register/route';
import { POST as preview } from '../app/api/v1/invitations/preview/route';

// D-162 · Limitation des abus sur les routes publiques : compteur en base, empreintes, routes réellement bloquées.
// Les routes sont appelées seulement dans le cas bloqué : elles refusent avant tout appel à Supabase.

let db: Db;
const env = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };

beforeAll(async () => {
  db = await openDatabase();
  setDb(db);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-de-test';
});
afterAll(() => {
  if (env.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = env.url;
  if (env.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.key;
});

async function exhaust(bucket: keyof typeof LIMITS, value: string) {
  for (let i = 0; i < LIMITS[bucket].max; i++) expect(await overLimit(bucket, value)).toBeNull();
}

function form(path: string, ip: string, fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST', body, headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'x-real-ip': ip },
  });
}
function json(path: string, ip: string, payload: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST', body: JSON.stringify(payload),
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'x-real-ip': ip, 'content-type': 'application/json' },
  });
}
const params = (res: Response) => new URL(res.headers.get('location')!).searchParams;

describe('compteur (D-162)', () => {
  it('laisse passer jusqu’à la limite, puis refuse avec le temps d’attente restant', async () => {
    await exhaust('signup.ip', '198.51.100.1');
    const wait = await overLimit('signup.ip', '198.51.100.1');
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(LIMITS['signup.ip'].windowS);
    expect(await overLimit('signup.ip', '198.51.100.2')).toBeNull(); // un autre visiteur n’est pas touché
    expect(await overLimit('forgot.ip', '198.51.100.1')).toBeNull(); // ni une autre route
  });

  it('« regarder » ne compte pas ; la limite des échecs se lit avant la tentative', async () => {
    for (let i = 0; i < 20; i++) expect(await overLimit('login.email', 'compte@exemple.test', { count: false })).toBeNull();
    await exhaust('login.email', 'Compte@Exemple.test '); // casse et espaces ignorés
    expect(await overLimit('login.email', 'compte@exemple.test', { count: false })).toBeGreaterThan(0);
  });

  it('ne garde ni adresse IP ni e-mail en clair', async () => {
    await overLimit('forgot.email', 'personne@exemple.test');
    await overLimit('forgot.ip', '203.0.113.99');
    const rows = (await db.query<{ k: string }>('select key_hash as k from private.rate_hits')).rows.map((r) => r.k).join(' ');
    expect(rows).not.toMatch(/personne|exemple|203\.0\.113/);
  });

  it('aucun utilisateur n’y a accès : la table est réservée au serveur', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const p of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        const r = await db.query<{ ok: boolean }>('select has_table_privilege($1, $2, $3) as ok', [role, 'private.rate_hits', p]);
        expect(r.rows[0]?.ok, `${role} ${p}`).toBe(false);
      }
    }
  });

  it('base indisponible : on laisse passer, la connexion ne dépend jamais de ce garde-fou', async () => {
    const other = await openDatabase();
    await other.exec('drop table private.rate_hits');
    setDb(other);
    try {
      expect(await overLimit('login.ip', '192.0.2.1')).toBeNull();
    } finally {
      setDb(db);
    }
  });

  it('adresse du visiteur et phrase d’attente', () => {
    const h = (o: Record<string, string>) => ({ headers: new Headers(o) });
    expect(clientIp(h({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '10.0.0.1' }))).toBe('203.0.113.5');
    expect(clientIp(h({ 'x-forwarded-for': '203.0.113.6, 10.0.0.1' }))).toBe('203.0.113.6');
    expect(clientIp(h({}))).toBe('inconnue');
    expect(waitSentence('1')).toBe('Trop de tentatives rapprochées. Réessaie dans 1 minute.');
    expect(waitSentence('15')).toBe('Trop de tentatives rapprochées. Réessaie dans 15 minutes.');
    expect(waitSentence('abc')).toBeNull();
    expect(waitSentence('9999')).toBeNull();
  });
});

describe('routes publiques bloquées (D-162)', () => {
  it('connexion : la 31e tentative d’une même connexion internet est refusée avec le temps d’attente', async () => {
    await exhaust('login.ip', '203.0.113.10');
    const res = await login(form('/auth/login', '203.0.113.10', { email: 'a@exemple.test', password: 'peu-importe', next: '/' }));
    expect(res.status).toBe(303);
    expect(params(res).get('error')).toBe('rate');
    expect(Number(params(res).get('wait'))).toBeGreaterThanOrEqual(1);
    expect(res.headers.get('location')).not.toContain('exemple'); // jamais l’adresse dans l’URL
  });

  it('connexion : 10 échecs sur un compte le protègent, même depuis une autre connexion internet', async () => {
    await exhaust('login.email', 'cible@exemple.test');
    const res = await login(form('/auth/login', '203.0.113.11', { email: 'cible@exemple.test', password: 'essai-11', next: '/' }));
    expect(params(res).get('error')).toBe('rate');
  });

  it('inscription et mot de passe oublié', async () => {
    await exhaust('signup.ip', '203.0.113.12');
    const s = await signup(form('/auth/signup', '203.0.113.12', { firstName: 'A', lastName: 'B', email: 'n@exemple.test', password: 'motdepasse-long', next: '/' }));
    expect(params(s).get('error')).toBe('rate');
    await exhaust('forgot.email', 'victime@exemple.test');
    const f = await forgot(form('/auth/forgot', '203.0.113.13', { email: 'victime@exemple.test' }));
    expect(params(f).get('error')).toBe('rate');
    expect(f.headers.get('location')).not.toContain('victime');
  });

  it('invitation : 429, message lisible et Retry-After', async () => {
    await exhaust('invite.ip', '203.0.113.14');
    const r = await inviteRegister(json('/auth/invite-register', '203.0.113.14', {}));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    const body = (await r.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toMatch(/^Trop de tentatives rapprochées\. Réessaie dans \d+ minutes?\.$/);
    await exhaust('preview.ip', '203.0.113.15');
    const p = await preview(json('/api/v1/invitations/preview', '203.0.113.15', { token: 'x' }));
    expect(p.status).toBe(429);
    expect(p.headers.get('retry-after')).not.toBeNull();
  });
});
