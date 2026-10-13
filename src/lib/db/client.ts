import { getPostgresAdapter } from "./adapters/postgres";
import type { DatabaseAdapter } from "./adapters/types";

export function getDatabaseAdapter(): DatabaseAdapter {
  return getPostgresAdapter();
}

export const db: DatabaseAdapter = {
  init: () => getDatabaseAdapter().init(),
  query: (sql, params) => getDatabaseAdapter().query(sql, params),
  queryOne: (sql, params) => getDatabaseAdapter().queryOne(sql, params),
  execute: (sql, params) => getDatabaseAdapter().execute(sql, params),
  transaction: (fn) => getDatabaseAdapter().transaction(fn),
};
