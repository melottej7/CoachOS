import pg from 'pg';

/**
 * Interface minimale commune à PGlite et à PostgreSQL (Supabase).
 * Le code métier n’utilise que query, exec et transaction.
 */
export interface Tx {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<unknown>;
}

export interface Db extends Tx {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

function wrap(client: pg.Pool | pg.PoolClient): Tx {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      const r = await client.query(sql, params as unknown[] | undefined);
      return { rows: r.rows as T[], affectedRows: r.rowCount ?? 0 };
    },
    async exec(sql: string) {
      return client.query(sql);
    },
  };
}

/** PostgreSQL via pg. Une transaction = une connexion du pool, rendue propre (role et réglages locaux). */
export function postgresDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 10, application_name: 'coachos-web' });
  const base = wrap(pool);
  return {
    ...base,
    async transaction<T>(fn: (tx: Tx) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(wrap(client));
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
