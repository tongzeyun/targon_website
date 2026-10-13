-- Rotate refresh sessions, detect replay, and support bounded lifecycle cleanup.

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS family_id TEXT,
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS replaced_by_id TEXT NULL;

UPDATE auth_sessions
SET family_id = id
WHERE family_id IS NULL;

ALTER TABLE auth_sessions
  ALTER COLUMN family_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_family_id
  ON auth_sessions(family_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_revoked_at
  ON auth_sessions(revoked_at)
  WHERE revoked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user_created
  ON auth_sessions(user_id, created_at DESC)
  WHERE revoked_at IS NULL;
