-- Phase 5: store generated document bytes in FileStorageAdapter instead of PostgreSQL.

ALTER TABLE generated_documents
  ADD COLUMN IF NOT EXISTS storage_driver TEXT,
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_metadata_json TEXT;
