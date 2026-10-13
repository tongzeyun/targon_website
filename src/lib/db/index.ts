import { db } from "./client";

export async function ensureDatabaseReady(): Promise<void> {
  await db.init();
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

export async function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return db.query<T>(sql, params);
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  return db.queryOne<T>(sql, params);
}

export async function execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  return db.execute(sql, params);
}

export { db, getDatabaseAdapter } from "./client";
export type { DatabaseAdapter } from "./adapters/types";
