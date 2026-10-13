import { db } from "@/lib/db";
import { serializeJson } from "@/lib/db/json";
import { camelize } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";

const now = () => new Date().toISOString();

export interface CreateResearchReportInput {
  productId: string;
  reportJson: unknown;
  accountsCreated: number;
  aiRunId: string;
}

export async function createResearchReport(organizationId: string, input: CreateResearchReportInput) {
  const id = uuid();
  const timestamp = now();
  await db.execute(
    `INSERT INTO research_reports (id, organization_id, product_id, report_json, accounts_created, created_at, ai_run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      organizationId,
      input.productId,
      serializeJson(input.reportJson, {}),
      input.accountsCreated,
      timestamp,
      input.aiRunId,
    ]
  );
  return { id };
}

export async function getLatestResearchReport(organizationId: string, productId?: string) {
  if (productId) {
    return camelize(await db.queryOne(
      "SELECT * FROM research_reports WHERE organization_id = $1 AND product_id = $2 ORDER BY created_at DESC LIMIT 1",
      [organizationId, productId]
    ));
  }
  return camelize(await db.queryOne(
    "SELECT * FROM research_reports WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1",
    [organizationId]
  ));
}

export async function getResearchReport(organizationId: string, reportId: string) {
  return camelize(await db.queryOne(
    "SELECT * FROM research_reports WHERE id = $1 AND organization_id = $2",
    [reportId, organizationId]
  ));
}
