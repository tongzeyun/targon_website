import type { AuthContext } from "@/lib/api/auth";
import { db } from "@/lib/db";
import { buildPgPlaceholders } from "@/lib/db/sql-params";
import { parseJsonObject, serializeJson } from "@/lib/db/json";
import { camelize, camelizeAll } from "@/lib/db/transform";
import { v4 as uuid } from "uuid";
import { normalizeTitle } from "./normalization";

export { normalizeTitle } from "./normalization";

const now = () => new Date().toISOString();

export type IntelligenceItemStatus = "candidate" | "promoting" | "promoted" | "rejected";
export type IntelligenceItemType = "candidate_account" | "candidate_project";

export interface CreateIntelligenceSourceInput {
  organizationId: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  sourceType: string;
  contentHash?: string | null;
  rawContent?: string | null;
  metadata?: unknown;
}

export interface CreateIntelligenceItemInput {
  organizationId: string;
  sourceId?: string | null;
  itemType: string;
  title: string;
  normalizedTitle?: string | null;
  extractedJson: unknown;
  confidenceScore?: number | null;
  status?: IntelligenceItemStatus;
  aiRunId?: string | null;
}

export interface CreateEvidenceLinkInput {
  itemId: string;
  fieldName: string;
  evidenceText?: string | null;
  sourceUrl?: string | null;
  confidenceScore?: number | null;
}

interface IntelligenceItemRow {
  id: string;
  organization_id: string;
  source_id?: string | null;
  item_type: string;
  title: string;
  normalized_title?: string | null;
  extracted_json?: string | null;
  confidence_score?: number | null;
  status: IntelligenceItemStatus;
  ai_run_id?: string | null;
}

export interface IntelligenceListFilters {
  status?: IntelligenceItemStatus;
  itemType?: IntelligenceItemType;
}

function readString(data: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function readNumber(data: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function readArray(data: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export async function findIntelligenceItemByTitle(
  organizationId: string,
  itemType: string,
  normalizedTitle: string
) {
  return db.queryOne(
    `SELECT * FROM intelligence_items
     WHERE organization_id = $1 AND item_type = $2 AND normalized_title = $3
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, itemType, normalizedTitle]
  );
}

export async function createIntelligenceSource(input: CreateIntelligenceSourceInput): Promise<string> {
  const id = uuid();
  const timestamp = now();
  await db.execute(
    `INSERT INTO intelligence_sources (
      id, organization_id, source_url, source_name, source_type, fetched_at,
      content_hash, raw_content, metadata, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      input.organizationId,
      input.sourceUrl || null,
      input.sourceName || null,
      input.sourceType,
      timestamp,
      input.contentHash || null,
      input.rawContent || null,
      serializeJson(input.metadata || {}, {}),
      timestamp,
    ]
  );
  return id;
}

export async function createIntelligenceItem(input: CreateIntelligenceItemInput): Promise<string> {
  const id = uuid();
  const timestamp = now();
  await db.execute(
    `INSERT INTO intelligence_items (
      id, organization_id, source_id, item_type, title, normalized_title,
      extracted_json, confidence_score, status, ai_run_id, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      input.organizationId,
      input.sourceId || null,
      input.itemType,
      input.title,
      input.normalizedTitle || normalizeTitle(input.title),
      serializeJson(input.extractedJson, {}),
      input.confidenceScore ?? null,
      input.status || "candidate",
      input.aiRunId || null,
      timestamp,
      timestamp,
    ]
  );
  return id;
}

export async function createEvidenceLink(input: CreateEvidenceLinkInput): Promise<string> {
  const id = uuid();
  await db.execute(
    `INSERT INTO evidence_links (
      id, item_id, field_name, evidence_text, source_url, confidence_score, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      input.itemId,
      input.fieldName,
      input.evidenceText || null,
      input.sourceUrl || null,
      input.confidenceScore ?? null,
      now(),
    ]
  );
  return id;
}

export async function listIntelligenceItems(ctx: AuthContext, filters: IntelligenceListFilters = {}) {
  const where = ["i.organization_id = $1"];
  const params: unknown[] = [ctx.organizationId];

  if (filters.status) {
    params.push(filters.status);
    where.push(`i.status = $${params.length}`);
  }

  if (filters.itemType) {
    params.push(filters.itemType);
    where.push(`i.item_type = $${params.length}`);
  }

  const rows = await db.query(
    `SELECT i.*, s.source_url, s.source_name, s.source_type, s.fetched_at
     FROM intelligence_items i
     LEFT JOIN intelligence_sources s ON i.source_id = s.id AND s.organization_id = i.organization_id
     WHERE ${where.join(" AND ")}
     ORDER BY i.created_at DESC`,
    params
  );

  return camelizeAll(rows);
}

export async function getIntelligenceItem(ctx: AuthContext, id: string) {
  const item = await db.queryOne(
    `SELECT i.*, s.source_url, s.source_name, s.source_type, s.raw_content, s.metadata
     FROM intelligence_items i
     LEFT JOIN intelligence_sources s ON i.source_id = s.id AND s.organization_id = i.organization_id
     WHERE i.id = $1 AND i.organization_id = $2`,
    [id, ctx.organizationId]
  );
  if (!item) return null;

  const evidence = await listEvidenceLinks(ctx, id);
  return {
    ...camelize(item),
    evidence,
  };
}

export async function listEvidenceLinks(ctx: AuthContext, itemId: string) {
  return camelizeAll(await db.query(
    `SELECT e.*
     FROM evidence_links e
     INNER JOIN intelligence_items i ON i.id = e.item_id
     WHERE e.item_id = $1 AND i.organization_id = $2
     ORDER BY e.created_at ASC`,
    [itemId, ctx.organizationId]
  ));
}

export async function markIntelligenceItemStatus(
  ctx: AuthContext,
  id: string,
  status: IntelligenceItemStatus
): Promise<boolean> {
  const statusGuard = status === "candidate" ? "" : " AND status = 'candidate'";
  const result = await db.execute(
    `UPDATE intelligence_items SET status = $1, updated_at = $2 WHERE id = $3 AND organization_id = $4${statusGuard}`,
    [status, now(), id, ctx.organizationId]
  );
  return result.changes > 0;
}

export async function promoteIntelligenceItem(ctx: AuthContext, id: string) {
  const item = await db.queryOne<IntelligenceItemRow>(
    "SELECT * FROM intelligence_items WHERE id = $1 AND organization_id = $2",
    [id, ctx.organizationId]
  );
  if (!item) return null;
  if (item.status !== "candidate") {
    throw new Error("Only candidate intelligence can be promoted");
  }

  if (item.item_type === "candidate_account") {
    return promoteCandidateAccount(ctx, item);
  }
  if (item.item_type === "candidate_project") {
    return promoteCandidateProject(ctx, item);
  }

  throw new Error(`Unsupported intelligence item type: ${item.item_type}`);
}

async function claimCandidateForPromotion(ctx: AuthContext, itemId: string) {
  const result = await db.execute(
    "UPDATE intelligence_items SET status = $1, updated_at = $2 WHERE id = $3 AND organization_id = $4 AND status = $5",
    ["promoting", now(), itemId, ctx.organizationId, "candidate"]
  );
  if (result.changes !== 1) {
    throw new Error("Only candidate intelligence can be promoted");
  }
}

async function finalizeCandidatePromotion(ctx: AuthContext, itemId: string) {
  const result = await db.execute(
    "UPDATE intelligence_items SET status = $1, updated_at = $2 WHERE id = $3 AND organization_id = $4 AND status = $5",
    ["promoted", now(), itemId, ctx.organizationId, "promoting"]
  );
  if (result.changes !== 1) {
    throw new Error("Failed to finalize intelligence promotion");
  }
}

async function promoteCandidateAccount(ctx: AuthContext, item: IntelligenceItemRow) {
  const data = parseJsonObject<Record<string, unknown>>(item.extracted_json, {});
  const id = uuid();
  const companyName = readString(data, ["companyName", "company_name"], item.title);

  await db.transaction(async () => {
    await claimCandidateForPromotion(ctx, item.id);

    await db.execute(
      `INSERT INTO target_accounts (
        id, organization_id, company_name, industry, sub_industry, size, revenue,
        website, locations, parent_company, tech_stack, match_score, match_reasoning,
        enriched_data, tags, status, created_at, updated_at, ai_run_id, intelligence_item_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        id,
        ctx.organizationId,
        companyName,
        readString(data, ["industry"]) || null,
        readString(data, ["subIndustry", "sub_industry"]) || null,
        readString(data, ["size"]) || null,
        readString(data, ["revenue"]) || null,
        readString(data, ["website"]) || null,
        serializeJson(readString(data, ["location"]) ? [{ city: readString(data, ["location"]), type: "HQ" }] : data.locations, []),
        readString(data, ["parentCompany", "parent_company"]) || null,
        serializeJson(data.techStack || data.tech_stack, {}),
        readNumber(data, ["matchScore", "match_score", "confidenceScore", "confidence_score"]),
        readString(data, ["matchReasoning", "match_reasoning", "whyTarget", "summary"]) || null,
        serializeJson(data.enrichedData || data.enriched_data, {}),
        serializeJson(data.tags, ["AI候选确认"]),
        "active",
        now(),
        now(),
        item.ai_run_id || null,
        item.id,
      ]
    );

    await finalizeCandidatePromotion(ctx, item.id);
  });

  return { type: "account", id };
}

async function promoteCandidateProject(ctx: AuthContext, item: IntelligenceItemRow) {
  const data = parseJsonObject<Record<string, unknown>>(item.extracted_json, {});
  const id = uuid();
  const projectName = readString(data, ["projectName", "project_name", "title"], item.title);
  const signalIds = readArray(data, ["signalIds", "sourceSignals", "source_signals"]);

  await db.transaction(async () => {
    await claimCandidateForPromotion(ctx, item.id);

    await db.execute(
      `INSERT INTO projects (
        id, organization_id, project_name, project_type, industry, budget_range,
        timeline, funding_source, status, confidence_score, summary, source_signals,
        matched_products, buyer_name, buyer_contact, location, created_at, updated_at,
        ai_run_id, intelligence_item_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        id,
        ctx.organizationId,
        projectName,
        readString(data, ["projectType", "project_type"], "early_signal"),
        readString(data, ["industry"]) || null,
        readString(data, ["budgetAmount", "budgetRange", "budget_range"]) || null,
        serializeJson(data.timeline, {}),
        readString(data, ["fundingSource", "funding_source"]) || null,
        "active",
        readNumber(data, ["confidenceScore", "confidence_score", "matchScore", "match_score"]),
        readString(data, ["summary", "description", "requirements"]) || null,
        serializeJson(signalIds, []),
        serializeJson(data.matchedProducts || data.matched_products, []),
        readString(data, ["companyName", "buyerName", "buyer_name"]) || null,
        serializeJson({
          name: readString(data, ["contactPerson"]),
          phone: readString(data, ["contactPhone"]),
        }, {}),
        readString(data, ["location"]) || null,
        now(),
        now(),
        item.ai_run_id || null,
        item.id,
      ]
    );

    if (signalIds.length > 0) {
      const ids = signalIds.filter((signalId): signalId is string => typeof signalId === "string" && signalId.trim().length > 0);
      if (ids.length > 0) {
        const inList = buildPgPlaceholders(ids.length, 3);
        await db.execute(
          `UPDATE project_signals SET project_id = $1 WHERE organization_id = $2 AND id IN (${inList})`,
          [id, ctx.organizationId, ...ids]
        );
      }
    }

    await finalizeCandidatePromotion(ctx, item.id);
  });

  return { type: "project", id };
}
