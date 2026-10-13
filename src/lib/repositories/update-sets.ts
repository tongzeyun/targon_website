function snakify(k: string) {
  return k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

/**
 * 安全构建 UPDATE SET 子句 — 仅允许白名单内的列名
 * 返回 { sets, params } 用于拼接 SQL
 */
export function buildUpdateSets(
  body: Record<string, unknown>,
  allowedColumns: readonly string[],
  options?: { exclude?: string[] }
): { sets: string[]; params: unknown[] } {
  const sets: string[] = [];
  const params: unknown[] = [];
  const exclude = new Set([
    "id",
    "organizationId",
    "organization_id",
    "createdAt",
    "created_at",
    "updatedAt",
    "updated_at",
    ...(options?.exclude || []),
  ]);
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || exclude.has(k)) continue;
    const col = snakify(k);
    if (!allowedColumns.includes(col)) continue;
    params.push(typeof v === "object" ? JSON.stringify(v) : v);
    sets.push(`${col} = $${params.length}`);
  }
  return { sets, params };
}

/** 各表允许更新的列白名单 */
export const ALLOWED_COLUMNS = {
  contacts: ["name", "title", "department", "role_in_decision", "influence_level", "contact_info", "social_url", "notes"],
  strategy_cards: ["title", "strategy_type", "priority", "content", "talking_points", "risk_alerts", "status", "assigned_to"],
  decision_chains: ["chain_data", "key_decision_makers", "buying_process", "notes"],
  products: ["name", "category", "model", "specs", "target_industries", "applications", "competitor_products", "price_range", "description", "is_active"],
  accounts: ["company_name", "industry", "sub_industry", "size", "revenue", "website", "locations", "parent_company", "tech_stack", "match_score", "match_reasoning", "enriched_data", "tags", "status"],
  projects: ["project_name", "project_type", "industry", "budget_range", "timeline", "funding_source", "status", "confidence_score", "summary", "source_signals", "matched_products", "buyer_name", "buyer_contact", "location"],
  pipeline: ["current_stage", "stage_updated_at", "expected_close_date", "deal_amount", "probability", "notes", "next_action", "next_action_date", "assigned_to"],
} as const;
