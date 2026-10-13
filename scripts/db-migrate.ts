import "./load-env";
import pg from "pg";
import { runMigrations } from "../src/lib/db/migrations/pg-runner";
import { ALL_TABLES } from "../src/lib/db/schema/tables";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  return url;
}

async function main() {
  const pool = new pg.Pool({ connectionString: requireDatabaseUrl() });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const { applied, version } = await runMigrations(client);
    await client.query("COMMIT");

    if (applied) {
      console.log(`Baseline schema applied (${ALL_TABLES.length} tables).`);
    } else {
      console.log("Baseline schema already up to date.");
    }
    console.log(`Schema version: ${version}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
