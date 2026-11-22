import { describe, expect, it } from 'vitest';
import { poolConfig } from './driver';

describe('poolConfig (D-113)', () => {
  it('chiffre la connexion vers la base en ligne, avec un petit pool', () => {
    const c = poolConfig('postgresql://postgres.abc:secret@aws-0-eu-west-3.pooler.supabase.com:6543/postgres');
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
    expect(c.max).toBe(3);
  });
  it('laisse la base locale sans chiffrement', () => {
    const c = poolConfig('postgresql://postgres:postgres@127.0.0.1:54322/postgres');
    expect(c.ssl).toBeUndefined();
    expect(c.max).toBe(10);
  });
  it('ignore les espaces et retours à la ligne autour de l’adresse', () => {
    const c = poolConfig('  postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres\n');
    expect(c.connectionString).toBe('postgresql://u:p@aws-0-eu-west-1.pooler.supabase.com:6543/postgres');
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
  });
  it('respecte un sslmode écrit dans l’adresse', () => {
    expect(poolConfig('postgresql://u:p@db.example.com:5432/postgres?sslmode=require').ssl).toBeUndefined();
  });
});
