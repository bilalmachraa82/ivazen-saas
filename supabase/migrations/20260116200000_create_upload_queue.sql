-- Supplemental upload queue setup.
-- The base table already exists from 20260116155228_3c237506-b9ae-43e5-ba27-7f75ba18dff7.sql
-- with the historical user_id / processed_at shape. Keep this migration compatible
-- with that earlier schema so a full migration replay remains valid.

CREATE INDEX IF NOT EXISTS idx_upload_queue_status_created
  ON public.upload_queue(status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_upload_queue_processing
  ON public.upload_queue(status)
  WHERE status = 'processing';

ALTER TABLE public.upload_queue ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('upload-queue', 'upload-queue', false, 5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_queue_stats(p_user_id UUID)
RETURNS TABLE (total_count BIGINT, pending_count BIGINT, processing_count BIGINT, completed_count BIGINT, failed_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT
  FROM public.upload_queue
  WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_queue_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.upload_queue
    WHERE status IN ('completed', 'failed')
      AND processed_at < now() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$;
