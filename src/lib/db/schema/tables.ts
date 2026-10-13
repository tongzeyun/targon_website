export const EXPECTED_SCHEMA_VERSION = 22;

/** All tables including schema_version (28 total). */
export const ALL_TABLES = [
  "schema_version",
  "organizations",
  "users",
  "auth_sessions",
  "provider_quota_leases",
  "products",
  "target_accounts",
  "contacts",
  "decision_chains",
  "strategy_cards",
  "projects",
  "project_signals",
  "bid_documents",
  "sales_pipelines",
  "alert_rules",
  "subscriptions",
  "app_settings",
  "research_reports",
  "activity_logs",
  "document_templates",
  "ai_prompt_versions",
  "ai_runs",
  "intelligence_sources",
  "intelligence_items",
  "evidence_links",
  "jobs",
  "generated_documents",
  "stored_files",
] as const;

export type TableName = (typeof ALL_TABLES)[number];
