import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { buildPgPlaceholders } from "@/lib/db/sql-params";
import { serializeJson } from "@/lib/db/json";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";
import { ALLOWED_COLUMNS, buildUpdateSets } from "./update-sets";

const now = () => new Date().toISOString();
const JUNK_KEYWORDS = ["医院", "医疗", "诊疗", "中医药", "护理", "临床", "病理"];

export async function getProjects(organizationId: string) {
  return camelizeAll(await db.query("SELECT * FROM projects WHERE organization_id = $1 ORDER BY created_at DESC", [organizationId]));
}

export async function getProject(id: string, organizationId: string) {
  return camelize(await db.queryOne("SELECT * FROM projects WHERE id = $1 AND organization_id = $2", [id, organizationId]));
}

export async function getProjectWithSignals(id: string, organizationId: string) {
  const project = await getProject(id, organizationId);
  if (!project) return null;
  const [signals, bidDocs] = await Promise.all([
    db.query("SELECT * FROM project_signals WHERE project_id = $1 AND organization_id = $2", [id, organizationId]),
    db.query("SELECT * FROM bid_documents WHERE project_id = $1 AND organization_id = $2", [id, organizationId]),
  ]);
  return {
    ...project,
    signals: camelizeAll(signals),
    bidDocuments: camelizeAll(bidDocs),
  };
}

export async function createProject(ctx: AuthContext, data: Record<string, unknown>) {
  const id = (data.id as string) || uuid();
  await db.execute(
    `INSERT INTO projects (id, organization_id, project_name, project_type, industry, budget_range, timeline, funding_source, status, confidence_score, summary, source_signals, matched_products, buyer_name, buyer_contact, location, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      id,
      ctx.organizationId,
      data.projectName,
      data.projectType || "public_bid",
      data.industry || null,
      data.budgetRange || null,
      serializeJson(data.timeline, {}),
      data.fundingSource || null,
      data.status || "active",
      data.confidenceScore || null,
      data.summary || null,
      serializeJson(data.sourceSignals, []),
      serializeJson(data.matchedProducts, []),
      data.buyerName || null,
      serializeJson(data.buyerContact, {}),
      data.location || null,
      now(),
      now(),
    ]
  );
  return getProject(id, ctx.organizationId);
}

export async function updateProject(id: string, ctx: AuthContext, data: Record<string, unknown>) {
  const { sets, params } = buildUpdateSets(data, ALLOWED_COLUMNS.projects);
  if (sets.length === 0) return null;
  params.push(now());
  sets.push(`updated_at = $${params.length}`);
  params.push(id);
  const idPh = `$${params.length}`;
  params.push(ctx.organizationId);
  const orgPh = `$${params.length}`;
  await db.execute(`UPDATE projects SET ${sets.join(", ")} WHERE id = ${idPh} AND organization_id = ${orgPh}`, params);
  return getProject(id, ctx.organizationId);
}

export async function cleanupProjects(ctx: AuthContext, mode = "clean") {
  const all = await db.query<{ id: string; project_name?: string; buyer_name?: string }>(
    "SELECT id, project_name, buyer_name FROM projects WHERE organization_id = $1",
    [ctx.organizationId]
  );

  const toRemove = mode === "all"
    ? all
    : all.filter((project) => {
        const projectName = (project.project_name || "").trim();
        const buyerName = (project.buyer_name || "").trim();
        return (
          !buyerName ||
          buyerName.length < 4 ||
          buyerName.includes("某") ||
          buyerName === "undefined" ||
          JUNK_KEYWORDS.some((keyword) => projectName.includes(keyword) || buyerName.includes(keyword))
        );
      });

  if (toRemove.length > 0) {
    await db.transaction(async () => {
      const ids = toRemove.map((project) => project.id);
      const inList = buildPgPlaceholders(ids.length, 2);
      const deleteParams = [ctx.organizationId, ...ids];
      await db.execute(`DELETE FROM project_signals WHERE organization_id = $1 AND project_id IN (${inList})`, deleteParams);
      await db.execute(`DELETE FROM bid_documents WHERE organization_id = $1 AND project_id IN (${inList})`, deleteParams);
      await db.execute(`DELETE FROM sales_pipelines WHERE organization_id = $1 AND project_id IN (${inList})`, deleteParams);
      await db.execute(`DELETE FROM projects WHERE organization_id = $1 AND id IN (${inList})`, deleteParams);
    });
  }

  return {
    cleaned: toRemove.length,
    remaining: all.length - toRemove.length,
    mode,
  };
}

export async function deleteProjectWithRelations(ctx: AuthContext, id: string): Promise<boolean> {
  const project = await db.queryOne("SELECT id FROM projects WHERE id = $1 AND organization_id = $2", [id, ctx.organizationId]);
  if (!project) return false;

  await db.transaction(async () => {
    await db.execute("DELETE FROM project_signals WHERE project_id = $1 AND organization_id = $2", [id, ctx.organizationId]);
    await db.execute("DELETE FROM bid_documents WHERE project_id = $1 AND organization_id = $2", [id, ctx.organizationId]);
    await db.execute("DELETE FROM sales_pipelines WHERE project_id = $1 AND organization_id = $2", [id, ctx.organizationId]);
    await db.execute("DELETE FROM projects WHERE id = $1 AND organization_id = $2", [id, ctx.organizationId]);
  });

  return true;
}
