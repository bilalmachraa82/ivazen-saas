-- DUPLICATE OF 20260116155600 - made idempotent with IF NOT EXISTS guards
-- This migration was a duplicate. The original tables were already created
-- in migration 20260116155600_580a6176-a857-4bc0-b1a9-b1644e9301f3.sql

CREATE TABLE IF NOT EXISTS upload_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL DEFAULT 2025,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data JSONB,
  confidence NUMERIC(3, 2),
  warnings TEXT[],
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_upload_queue_client_status ON upload_queue(client_id, status);
CREATE INDEX IF NOT EXISTS idx_upload_queue_status_created ON upload_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_upload_queue_processing ON upload_queue(status) WHERE status = 'processing';

ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own queue items" ON upload_queue;
CREATE POLICY "Users can view own queue items"
  ON upload_queue FOR SELECT USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Users can insert own queue items" ON upload_queue;
CREATE POLICY "Users can insert own queue items"
  ON upload_queue FOR INSERT WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Users can delete own queue items" ON upload_queue;
CREATE POLICY "Users can delete own queue items"
  ON upload_queue FOR DELETE USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Service role can update queue items" ON upload_queue;
CREATE POLICY "Service role can update queue items"
  ON upload_queue FOR UPDATE USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('upload-queue', 'upload-queue', false, 5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION get_queue_stats(user_id UUID)
RETURNS TABLE (total_count BIGINT, pending_count BIGINT, processing_count BIGINT, completed_count BIGINT, failed_count BIGINT)
AS $$
BEGIN
  RETURN QUERY SELECT
    COUNT(*)::BIGINT, COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT, COUNT(*) FILTER (WHERE status = 'completed')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT
  FROM upload_queue WHERE client_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM upload_queue WHERE status IN ('completed', 'failed') AND completed_at < now() - INTERVAL '7 days' RETURNING id
  ) SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
