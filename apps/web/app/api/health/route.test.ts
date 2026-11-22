import { beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, setDb, type Db } from '@/server/db/client';
import { GET } from './route';

describe('GET /api/health (D-114)', () => {
  beforeAll(async () => { setDb(await openDatabase()); });

  it('répond ok quand la base est joignable', async () => {
    const r = await GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, db: 'ok' });
    expect(r.headers.get('cache-control')).toBe('no-store');
  });

  it('renvoie seulement un code court quand la base échoue', async () => {
    const broken = { query: async () => { throw Object.assign(new Error('password authentication failed for user "x" at host'), { code: '28P01' }); } } as unknown as Db;
    setDb(broken);
    const r = await GET();
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ ok: false, db: '28P01' });
  });
});
