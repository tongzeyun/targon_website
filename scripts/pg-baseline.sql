-- SalesEye PostgreSQL baseline schema (v22 final state)
-- Timestamps: TIMESTAMPTZ. Booleans: BOOLEAN. Floats: DOUBLE PRECISION.
-- Business dates (expected_close_date, next_action_date, submission_deadline) remain TEXT.

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'member',
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  family_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  rotated_at TIMESTAMPTZ NULL,
  replaced_by_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_quota_leases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  operation TEXT NOT NULL,
  job_id TEXT,
  ai_run_id TEXT,
  idempotency_key TEXT,
  status TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  model TEXT,
  specs TEXT DEFAULT '{}',
  target_industries TEXT DEFAULT '[]',
  applications TEXT DEFAULT '[]',
  competitor_products TEXT DEFAULT '[]',
  price_range TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS target_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT,
  sub_industry TEXT,
  size TEXT,
  revenue TEXT,
  website TEXT,
  locations TEXT DEFAULT '[]',
  parent_company TEXT,
  tech_stack TEXT DEFAULT '{}',
  match_score INTEGER,
  match_reasoning TEXT,
  enriched_data TEXT DEFAULT '{}',
  tags TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  last_enriched_at TIMESTAMPTZ,
  ai_run_id TEXT,
  intelligence_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  account_id TEXT NOT NULL REFERENCES target_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  role_in_decision TEXT,
  influence_level INTEGER,
  contact_info TEXT DEFAULT '{}',
  social_url TEXT,
  notes TEXT,
  last_verified_at TIMESTAMPTZ,
  ai_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_chains (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  account_id TEXT UNIQUE NOT NULL REFERENCES target_accounts(id) ON DELETE CASCADE,
  steps TEXT NOT NULL DEFAULT '[]',
  summary TEXT,
  ai_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_cards (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  account_id TEXT NOT NULL REFERENCES target_accounts(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  recommended_approach TEXT,
  key_milestones TEXT NOT NULL DEFAULT '[]',
  competitor_analysis TEXT,
  talking_points TEXT DEFAULT '[]',
  risk_warnings TEXT DEFAULT '[]',
  generated_by TEXT,
  generated_at TIMESTAMPTZ NOT NULL,
  ai_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  project_type TEXT DEFAULT 'public_bid',
  industry TEXT,
  budget_range TEXT,
  timeline TEXT DEFAULT '{}',
  funding_source TEXT,
  status TEXT DEFAULT 'active',
  confidence_score INTEGER,
  summary TEXT,
  source_signals TEXT DEFAULT '[]',
  matched_products TEXT DEFAULT '[]',
  buyer_name TEXT,
  buyer_contact TEXT DEFAULT '{}',
  location TEXT,
  ai_run_id TEXT,
  intelligence_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS project_signals (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  title TEXT NOT NULL,
  publish_date TIMESTAMPTZ,
  raw_content TEXT,
  extracted_data TEXT DEFAULT '{}',
  relevance_score INTEGER,
  is_processed BOOLEAN DEFAULT FALSE,
  processing_notes TEXT,
  processed_at TIMESTAMPTZ,
  ai_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS bid_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  bid_platform TEXT,
  bid_number TEXT,
  publish_date TIMESTAMPTZ,
  submission_deadline TEXT,
  budget_amount TEXT,
  buyer_name TEXT,
  buyer_contact TEXT DEFAULT '{}',
  requirements TEXT,
  attachments TEXT DEFAULT '[]',
  eligibility_criteria TEXT DEFAULT '[]',
  ai_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_pipelines (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  account_id TEXT REFERENCES target_accounts(id) ON DELETE SET NULL,
  current_stage TEXT DEFAULT 'discovered',
  stage_updated_at TIMESTAMPTZ NOT NULL,
  expected_close_date TEXT,
  deal_amount TEXT,
  probability INTEGER,
  notes TEXT,
  next_action TEXT,
  next_action_date TEXT,
  created_by TEXT REFERENCES users(id),
  assigned_to TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keywords TEXT DEFAULT '[]',
  industries TEXT DEFAULT '[]',
  regions TEXT DEFAULT '[]',
  product_ids TEXT DEFAULT '[]',
  alert_channels TEXT DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'trialing',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS research_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  product_id TEXT,
  report_json TEXT NOT NULL,
  accounts_created INTEGER DEFAULT 0,
  ai_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS document_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  template_type TEXT NOT NULL,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  parsed_text TEXT,
  structure TEXT,
  placeholders TEXT,
  file_data TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  system_prompt TEXT,
  user_prompt_template TEXT,
  schema_name TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  task_type TEXT NOT NULL,
  prompt_version TEXT,
  schema_name TEXT,
  model TEXT,
  provider TEXT,
  input_json TEXT,
  raw_output TEXT,
  parsed_output TEXT,
  validation_status TEXT NOT NULL,
  validation_errors TEXT,
  latency_ms INTEGER,
  token_usage TEXT,
  cost_estimate DOUBLE PRECISION,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS intelligence_sources (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  source_url TEXT,
  source_name TEXT,
  source_type TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT,
  raw_content TEXT,
  metadata TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS intelligence_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  source_id TEXT,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  normalized_title TEXT,
  extracted_json TEXT,
  confidence_score DOUBLE PRECISION,
  status TEXT NOT NULL,
  ai_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  evidence_text TEXT,
  source_url TEXT,
  confidence_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  payload_json TEXT,
  result_json TEXT,
  error_message TEXT,
  progress INTEGER DEFAULT 0,
  current_step TEXT,
  provider_task_id TEXT,
  provider_task_resource TEXT,
  provider_task_status TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS generated_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  job_id TEXT,
  template_id TEXT,
  ai_run_id TEXT,
  document_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_data TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  metadata_json TEXT,
  storage_driver TEXT,
  storage_key TEXT,
  storage_bucket TEXT,
  storage_metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS stored_files (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  purpose TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_data TEXT NOT NULL,
  sha256 TEXT,
  metadata_json TEXT,
  expires_at TIMESTAMPTZ,
  storage_driver TEXT,
  storage_key TEXT,
  storage_bucket TEXT,
  storage_metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

-- Indexes (v7-v21)
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_family_id ON auth_sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_revoked_at
  ON auth_sessions(revoked_at) WHERE revoked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user_created
  ON auth_sessions(user_id, created_at DESC) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_provider_quota_user_resource_status_finished
  ON provider_quota_leases(user_id, resource, status, finished_at);
CREATE INDEX IF NOT EXISTS idx_provider_quota_active_expiry
  ON provider_quota_leases(user_id, resource, status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_quota_idempotency
  ON provider_quota_leases(user_id, resource, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_provider_quota_terminal_finished
  ON provider_quota_leases(status, finished_at);
CREATE INDEX IF NOT EXISTS idx_contacts_org_account ON contacts(organization_id, account_id);
CREATE INDEX IF NOT EXISTS idx_decision_chains_org_account ON decision_chains(organization_id, account_id);
CREATE INDEX IF NOT EXISTS idx_strategy_cards_org_account ON strategy_cards(organization_id, account_id);
CREATE INDEX IF NOT EXISTS idx_bid_documents_org_project ON bid_documents(organization_id, project_id);
CREATE INDEX IF NOT EXISTS idx_products_org_created ON products(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_org_status ON target_accounts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_org_status_created ON projects(organization_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_project_signals_org_source ON project_signals(organization_id, source_url);
CREATE INDEX IF NOT EXISTS idx_project_signals_org_project ON project_signals(organization_id, project_id);
CREATE INDEX IF NOT EXISTS idx_sales_pipelines_org_stage ON sales_pipelines(organization_id, current_stage);
CREATE INDEX IF NOT EXISTS idx_templates_org_type_created ON document_templates(organization_id, template_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_runs_org_task_created ON ai_runs(organization_id, task_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_runs_status_created ON ai_runs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_intelligence_sources_org_url ON intelligence_sources(organization_id, source_url);
CREATE INDEX IF NOT EXISTS idx_intelligence_sources_org_hash ON intelligence_sources(organization_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_intelligence_items_org_status ON intelligence_items(organization_id, status, item_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_items_org_title ON intelligence_items(organization_id, normalized_title);
CREATE INDEX IF NOT EXISTS idx_evidence_links_item ON evidence_links(item_id);
CREATE INDEX IF NOT EXISTS idx_accounts_org_ai_run ON target_accounts(organization_id, ai_run_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_ai_run ON projects(organization_id, ai_run_id);
CREATE INDEX IF NOT EXISTS idx_signals_org_ai_run ON project_signals(organization_id, ai_run_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status_created ON jobs(organization_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_priority_created ON jobs(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_locked_at ON jobs(locked_at);
CREATE INDEX IF NOT EXISTS idx_accounts_org_intelligence_item ON target_accounts(organization_id, intelligence_item_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_intelligence_item ON projects(organization_id, intelligence_item_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_org_created ON generated_documents(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_documents_org_type_created ON generated_documents(organization_id, document_type, created_at);
CREATE INDEX IF NOT EXISTS idx_generated_documents_org_job ON generated_documents(organization_id, job_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_org_purpose ON stored_files(organization_id, purpose);
CREATE INDEX IF NOT EXISTS idx_stored_files_org_created ON stored_files(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stored_files_expires_at ON stored_files(expires_at);
