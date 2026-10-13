import type pg from "pg";
import { ALL_TABLES, EXPECTED_SCHEMA_VERSION } from "./schema/tables";

export const SCHEMA_NOT_READY_MESSAGE =
  "Schema not ready. Run: npm run db:migrate";

export async function validateSchema(pool: pg.Pool | pg.PoolClient): Promise<void> {
  const { rows: tableRows } = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const existing = new Set(tableRows.map((row) => row.table_name));
  const missing = ALL_TABLES.filter((table) => !existing.has(table));

  if (missing.length > 0) {
    throw new Error(`${SCHEMA_NOT_READY_MESSAGE} (missing tables: ${missing.join(", ")})`);
  }

  let versionRow: { max_version: number | null };
  try {
    const result = await pool.query<{ max_version: number | null }>(
      "SELECT MAX(version) AS max_version FROM schema_version"
    );
    versionRow = result.rows[0] ?? { max_version: null };
  } catch {
    throw new Error(`${SCHEMA_NOT_READY_MESSAGE} (schema_version unreadable)`);
  }

  const currentVersion = versionRow.max_version ?? 0;
  if (currentVersion < EXPECTED_SCHEMA_VERSION) {
    throw new Error(
      `${SCHEMA_NOT_READY_MESSAGE} (schema version ${currentVersion}, expected >= ${EXPECTED_SCHEMA_VERSION})`
    );
  }
}
