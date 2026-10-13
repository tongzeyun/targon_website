import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";
import { ALLOWED_COLUMNS, buildUpdateSets } from "./update-sets";

const now = () => new Date().toISOString();

export async function getPipelines(organizationId: string) {
  return camelizeAll(await db.query(
    `SELECT p.*, pr.project_name as project_name
     FROM sales_pipelines p
     LEFT JOIN projects pr ON p.project_id = pr.id
     WHERE p.organization_id = $1
     ORDER BY p.updated_at DESC`,
    [organizationId]
  ));
}

export async function getLatestProductIdForAccount(
  accountId: string,
  organizationId: string
): Promise<string | null> {
  const row = await db.queryOne<{ product_id: string | null }>(
    `SELECT product_id
     FROM sales_pipelines
     WHERE account_id = $1 AND organization_id = $2 AND product_id IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [accountId, organizationId]
  );
  return row?.product_id || null;
}

export async function createPipelineItem(ctx: AuthContext, data: Record<string, unknown>) {
  const id = (data.id as string) || uuid();
  await db.execute(
    `INSERT INTO sales_pipelines (id, organization_id, project_id, product_id, account_id, current_stage, stage_updated_at, expected_close_date, deal_amount, probability, notes, next_action, next_action_date, created_by, assigned_to, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      id,
      ctx.organizationId,
      data.projectId || null,
      data.productId || null,
      data.accountId || null,
      data.currentStage || "discovered",
      now(),
      data.expectedCloseDate || null,
      data.dealAmount || null,
      data.probability || null,
      data.notes || null,
      data.nextAction || null,
      data.nextActionDate || null,
      data.createdBy || null,
      data.assignedTo || null,
      now(),
      now(),
    ]
  );
  return camelize(await db.queryOne("SELECT * FROM sales_pipelines WHERE id = $1 AND organization_id = $2", [id, ctx.organizationId]));
}

export async function updatePipelineItem(id: string, ctx: AuthContext, data: Record<string, unknown>) {
  const { sets, params } = buildUpdateSets(data, ALLOWED_COLUMNS.pipeline);
  if (sets.length === 0) return null;
  params.push(now());
  sets.push(`updated_at = $${params.length}`);
  params.push(id);
  const idPh = `$${params.length}`;
  params.push(ctx.organizationId);
  const orgPh = `$${params.length}`;
  await db.execute(`UPDATE sales_pipelines SET ${sets.join(", ")} WHERE id = ${idPh} AND organization_id = ${orgPh}`, params);
  return camelize(await db.queryOne("SELECT * FROM sales_pipelines WHERE id = $1 AND organization_id = $2", [id, ctx.organizationId]));
}
