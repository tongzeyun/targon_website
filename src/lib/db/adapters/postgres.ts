import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import type { DatabaseAdapter } from "./types";
import { validateSchema } from "../schema-validation";

const txStore = new AsyncLocalStorage<pg.PoolClient>();

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  return url;
}

export class PostgresDatabaseAdapter implements DatabaseAdapter {
  private pool: pg.Pool | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.pool && this.initPromise) {
      await this.initPromise;
      return;
    }
    if (!this.initPromise) {
      this.initPromise = this.initPool().catch((error) => {
        // A database started after Web/Worker must be retryable on the next request.
        this.initPromise = null;
        throw error;
      });
    }
    await this.initPromise;
  }

  private async initPool(): Promise<void> {
    const pool = new pg.Pool({ connectionString: requireDatabaseUrl() });
    try {
      await validateSchema(pool);
      this.pool = pool;
    } catch (error) {
      await pool.end().catch(() => {});
      throw error;
    }
  }

  private executor(): pg.Pool | pg.PoolClient {
    const client = txStore.getStore();
    if (client) return client;
    if (!this.pool) {
      throw new Error("Database is not initialized. Call init() first.");
    }
    return this.pool;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.init();
    const result = await this.executor().query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    await this.init();
    const result = await this.executor().query(sql, params);
    return { changes: result.rowCount ?? 0 };
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.init();
    if (txStore.getStore()) {
      return fn();
    }

    if (!this.pool) {
      throw new Error("Database is not initialized. Call init() first.");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await txStore.run(client, fn);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  getPool(): pg.Pool {
    if (!this.pool) {
      throw new Error("Database is not initialized. Call init() first.");
    }
    return this.pool;
  }
}

let adapter: PostgresDatabaseAdapter | null = null;

export function getPostgresAdapter(): PostgresDatabaseAdapter {
  if (!adapter) adapter = new PostgresDatabaseAdapter();
  return adapter;
}
