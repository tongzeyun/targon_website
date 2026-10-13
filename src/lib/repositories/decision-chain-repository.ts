import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { ALLOWED_COLUMNS, buildUpdateSets } from "@/lib/repositories/update-sets";
import { camelize } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

export interface ReplaceDecisionChainInput {
  steps: unknown;
  summary?: string;
  aiRunId: string;
}

export async function updateDecisionChain(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const existing = await db.queryOne(
    "SELECT id FROM decision_chains WHERE id = $1 AND organization_id = $2",
    [id, ctx.organizationId]
  );
  if (!existing) return null;

  const { sets, params } = buildUpdateSets(body, ALLOWED_COLUMNS.decision_chains);
  if (sets.length > 0) {
    params.push(new Date().toISOString());
    sets.push(`updated_at = $${params.length}`);
    params.push(id);
    const idPh = `$${params.length}`;
    params.push(ctx.organizationId);
    const orgPh = `$${params.length}`;
    await db.execute(`UPDATE decision_chains SET ${sets.join(", ")} WHERE id = ${idPh} AND organization_id = ${orgPh}`, params);
  }

  return camelize(await db.queryOne("SELECT * FROM decision_chains WHERE id = $1 AND organization_id = $2", [id, ctx.organizationId]));
}

export async function replaceDecisionChainForAccount(
  ctx: AuthContext,
  accountId: string,
  input: ReplaceDecisionChainInput
) {
  const account = await db.queryOne(
    "SELECT id FROM target_accounts WHERE id = $1 AND organization_id = $2",
    [accountId, ctx.organizationId]
  );
  if (!account) return null;

  const timestamp = now();
  await db.transaction(async () => {
    await db.execute(
      "DELETE FROM decision_chains WHERE account_id = $1 AND organization_id = $2",
      [accountId, ctx.organizationId]
    );
    await db.execute(
      `INSERT INTO decision_chains (id, organization_id, account_id, steps, summary, created_at, updated_at, ai_run_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        uuid(),
        ctx.organizationId,
        accountId,
        serializeJson(input.steps, []),
        input.summary || "AI深度完善",
        timestamp,
        timestamp,
        input.aiRunId,
      ]
    );
  });
  return { accountId };
}
