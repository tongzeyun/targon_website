import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { ALLOWED_COLUMNS, buildUpdateSets } from "@/lib/repositories/update-sets";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

export interface CreateStrategyCardInput {
  accountId: string;
  productId: string;
  recommendedApproach: string;
  keyMilestones: unknown;
  competitorAnalysis: string;
  talkingPoints: unknown;
  riskWarnings: unknown;
  generatedBy: string;
  aiRunId: string;
}

export async function getStrategyCards(accountId: string, organizationId: string) {
  return camelizeAll(await db.query(
    "SELECT * FROM strategy_cards WHERE account_id = $1 AND organization_id = $2 ORDER BY generated_at DESC",
    [accountId, organizationId]
  ));
}

export async function listStrategyCards(ctx: AuthContext) {
  return camelizeAll(await db.query("SELECT * FROM strategy_cards WHERE organization_id = $1", [ctx.organizationId]));
}

export async function updateStrategyCard(ctx: AuthContext, id: string, body: Record<string, unknown>) {
  const existing = await db.queryOne(
    "SELECT id FROM strategy_cards WHERE id = $1 AND organization_id = $2",
    [id, ctx.organizationId]
  );
  if (!existing) return null;

  const { sets, params } = buildUpdateSets(body, ALLOWED_COLUMNS.strategy_cards);
  if (sets.length > 0) {
    params.push(new Date().toISOString());
    sets.push(`updated_at = $${params.length}`);
    params.push(id);
    const idPh = `$${params.length}`;
    params.push(ctx.organizationId);
    const orgPh = `$${params.length}`;
    await db.execute(`UPDATE strategy_cards SET ${sets.join(", ")} WHERE id = ${idPh} AND organization_id = ${orgPh}`, params);
  }

  return camelize(await db.queryOne("SELECT * FROM strategy_cards WHERE id = $1 AND organization_id = $2", [id, ctx.organizationId]));
}

export async function createStrategyCard(ctx: AuthContext, input: CreateStrategyCardInput) {
  const account = await db.queryOne(
    "SELECT id FROM target_accounts WHERE id = $1 AND organization_id = $2",
    [input.accountId, ctx.organizationId]
  );
  if (!account) return null;

  const id = uuid();
  const timestamp = now();
  await db.execute(
    `INSERT INTO strategy_cards (id, organization_id, account_id, product_id, recommended_approach, key_milestones, competitor_analysis, talking_points, risk_warnings, generated_by, generated_at, created_at, ai_run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      ctx.organizationId,
      input.accountId,
      input.productId,
      input.recommendedApproach,
      serializeJson(input.keyMilestones, []),
      input.competitorAnalysis,
      serializeJson(input.talkingPoints, []),
      serializeJson(input.riskWarnings, []),
      input.generatedBy,
      timestamp,
      timestamp,
      input.aiRunId,
    ]
  );
  return { id };
}
