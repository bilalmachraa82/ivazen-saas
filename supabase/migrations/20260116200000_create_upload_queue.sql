-- DUPLICATE OF 20260116165205 - made into no-op
-- The upload_queue table was already created in migration 20260116165205
-- The client_id column is added later in migration 20260126200000
-- All indexes and RLS policies are handled by those migrations

-- Only create non-client_id dependent indexes if table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'upload_queue') THEN
    CREATE INDEX IF NOT EXISTS idx_upload_queue_status_created ON upload_queue(status, created_at) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_upload_queue_processing ON upload_queue(status) WHERE status = 'processing';
  END IF;
END $$;

-- Storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('upload-queue', 'upload-queue', false, 5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Helper functions (these don't depend on client_id column name)
CREATE OR REPLACE FUNCTION get_queue_stats(p_user_id UUID)
RETURNS TABLE (total_count BIGINT, pending_count BIGINT, processing_count BIGINT, completed_count BIGINT, failed_count BIGINT)
AS $$
BEGIN
  RETURN QUERY SELECT
    COUNT(*)::BIGINT, COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT, COUNT(*) FILTER (WHERE status = 'completed')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT
  FROM upload_queue WHERE upload_queue.user_id = p_user_id;
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
