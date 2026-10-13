import fs from "fs";
import path from "path";
import type pg from "pg";
import { EXPECTED_SCHEMA_VERSION } from "../schema/tables";
import { validateSchema } from "../schema-validation";

const BASELINE_PATH = path.join(process.cwd(), "scripts", "pg-baseline.sql");
const MIGRATIONS_DIR = path.join(process.cwd(), "scripts", "pg-migrations");

export function splitSqlStatements(sql: string): string[] {
  const withoutPureCommentLines = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return withoutPureCommentLines
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

export function parseMigrationVersion(filename: string): number | null {
  const match = /^(\d+)-/.exec(filename);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function listPendingMigrationFiles(currentVersion: number): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({ name, version: parseMigrationVersion(name) }))
    .filter((entry): entry is { name: string; version: number } => entry.version != null)
    .filter((entry) => entry.version > currentVersion && entry.version <= EXPECTED_SCHEMA_VERSION)
    .sort((a, b) => a.version - b.version)
    .map((entry) => entry.name);
}

export async function getCurrentSchemaVersion(client: pg.Pool | pg.PoolClient): Promise<number> {
  const tableResult = await client.query<{ table_name: string | null }>(
    "SELECT to_regclass('public.schema_version')::text AS table_name"
  );
  if (!tableResult.rows[0]?.table_name) {
    return 0;
  }

  const result = await client.query<{ max_version: number | null }>(
    "SELECT MAX(version) AS max_version FROM schema_version"
  );
  return result.rows[0]?.max_version ?? 0;
}

export async function applyBaselineIfNeeded(client: pg.Pool | pg.PoolClient): Promise<boolean> {
  const currentVersion = await getCurrentSchemaVersion(client);
  if (currentVersion > 0) {
    return false;
  }

  const baselineSql = fs.readFileSync(BASELINE_PATH, "utf8");
  const statements = splitSqlStatements(baselineSql);
  for (const statement of statements) {
    await client.query(statement);
  }

  return true;
}

export async function applyPendingMigrations(client: pg.Pool | pg.PoolClient): Promise<number> {
  let currentVersion = await getCurrentSchemaVersion(client);
  const pendingFiles = listPendingMigrationFiles(currentVersion);
  let appliedCount = 0;

  for (const filename of pendingFiles) {
    const version = parseMigrationVersion(filename);
    if (version == null) continue;

    const migrationSql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
    const statements = splitSqlStatements(migrationSql);
    for (const statement of statements) {
      await client.query(statement);
    }

    await recordSchemaVersion(client, version);
    currentVersion = version;
    appliedCount += 1;
  }

  return appliedCount;
}

export async function recordSchemaVersion(
  client: pg.Pool | pg.PoolClient,
  version = EXPECTED_SCHEMA_VERSION
): Promise<void> {
  const appliedAt = new Date().toISOString();
  await client.query(
    `INSERT INTO schema_version (version, applied_at)
     VALUES ($1, $2)
     ON CONFLICT (version) DO UPDATE SET applied_at = EXCLUDED.applied_at`,
    [version, appliedAt]
  );
}

export async function runMigrations(client: pg.Pool | pg.PoolClient): Promise<{ applied: boolean; version: number }> {
  const baselineApplied = await applyBaselineIfNeeded(client);

  if (baselineApplied) {
    await recordSchemaVersion(client, EXPECTED_SCHEMA_VERSION);
  } else {
    await applyPendingMigrations(client);
  }

  await validateSchema(client);
  const version = await getCurrentSchemaVersion(client);
  return { applied: baselineApplied, version };
}
