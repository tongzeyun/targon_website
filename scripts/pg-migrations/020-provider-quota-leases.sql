-- Provider quota reservations are keyed by the authenticated user.
-- Active rows reserve capacity; only succeeded rows consume the Beijing calendar-day quota.

CREATE TABLE IF NOT EXISTS provider_quota_leases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  operation TEXT NOT NULL,
  job_id TEXT,
  ai_run_id TEXT,
  status TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_provider_quota_user_resource_status_finished
  ON provider_quota_leases(user_id, resource, status, finished_at);
CREATE INDEX IF NOT EXISTS idx_provider_quota_active_expiry
  ON provider_quota_leases(user_id, resource, status, expires_at);
