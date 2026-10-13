-- Phase 4: migrate timestamp columns to TIMESTAMPTZ and boolean columns to BOOLEAN

ALTER TABLE schema_version
  ALTER COLUMN applied_at TYPE TIMESTAMPTZ USING applied_at::timestamptz;

ALTER TABLE organizations
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE products
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE target_accounts
  ALTER COLUMN last_enriched_at TYPE TIMESTAMPTZ USING last_enriched_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE contacts
  ALTER COLUMN last_verified_at TYPE TIMESTAMPTZ USING last_verified_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE decision_chains
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE strategy_cards
  ALTER COLUMN generated_at TYPE TIMESTAMPTZ USING generated_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE projects
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE project_signals
  ALTER COLUMN publish_date TYPE TIMESTAMPTZ USING publish_date::timestamptz,
  ALTER COLUMN processed_at TYPE TIMESTAMPTZ USING processed_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE bid_documents
  ALTER COLUMN publish_date TYPE TIMESTAMPTZ USING publish_date::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE sales_pipelines
  ALTER COLUMN stage_updated_at TYPE TIMESTAMPTZ USING stage_updated_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE alert_rules
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE subscriptions
  ALTER COLUMN current_period_start TYPE TIMESTAMPTZ USING current_period_start::timestamptz,
  ALTER COLUMN current_period_end TYPE TIMESTAMPTZ USING current_period_end::timestamptz,
  ALTER COLUMN trial_ends_at TYPE TIMESTAMPTZ USING trial_ends_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE app_settings
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE research_reports
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE activity_logs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE document_templates
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE ai_prompt_versions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE ai_runs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE intelligence_sources
  ALTER COLUMN fetched_at TYPE TIMESTAMPTZ USING fetched_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE intelligence_items
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE evidence_links
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE jobs
  ALTER COLUMN locked_at TYPE TIMESTAMPTZ USING locked_at::timestamptz,
  ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at::timestamptz,
  ALTER COLUMN finished_at TYPE TIMESTAMPTZ USING finished_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE generated_documents
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;

ALTER TABLE stored_files
  ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at::timestamptz,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

ALTER TABLE products
  ALTER COLUMN is_active DROP DEFAULT;

ALTER TABLE products
  ALTER COLUMN is_active TYPE BOOLEAN USING CASE
    WHEN is_active IS NULL THEN NULL
    WHEN is_active = 1 THEN TRUE
    ELSE FALSE
  END,
  ALTER COLUMN is_active SET DEFAULT TRUE;

ALTER TABLE project_signals
  ALTER COLUMN is_processed DROP DEFAULT;

ALTER TABLE project_signals
  ALTER COLUMN is_processed TYPE BOOLEAN USING CASE
    WHEN is_processed IS NULL THEN NULL
    WHEN is_processed = 1 THEN TRUE
    ELSE FALSE
  END,
  ALTER COLUMN is_processed SET DEFAULT FALSE;

ALTER TABLE alert_rules
  ALTER COLUMN is_active DROP DEFAULT;

ALTER TABLE alert_rules
  ALTER COLUMN is_active TYPE BOOLEAN USING CASE
    WHEN is_active IS NULL THEN NULL
    WHEN is_active = 1 THEN TRUE
    ELSE FALSE
  END,
  ALTER COLUMN is_active SET DEFAULT TRUE;
