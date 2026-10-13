-- Persist asynchronous provider task identifiers so Worker retries can resume
-- the same paid task. Quota idempotency prevents the resumed task from being
-- counted more than once.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS provider_task_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_task_resource TEXT,
  ADD COLUMN IF NOT EXISTS provider_task_status TEXT;

ALTER TABLE provider_quota_leases
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_quota_idempotency
  ON provider_quota_leases(user_id, resource, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_quota_terminal_finished
  ON provider_quota_leases(status, finished_at);
