-- Create upload queue table for background processing
-- This allows users to upload large batches of documents that are processed asynchronously

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

-- Indexes for efficient querying
CREATE INDEX idx_upload_queue_client_status ON upload_queue(client_id, status);
CREATE INDEX idx_upload_queue_status_created ON upload_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_upload_queue_processing ON upload_queue(status) WHERE status = 'processing';

-- Enable RLS
ALTER TABLE upload_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own queue items"
  ON upload_queue FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Users can insert own queue items"
  ON upload_queue FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Users can delete own queue items"
  ON upload_queue FOR DELETE
  USING (auth.uid() = client_id);

-- Service role can update (for background worker)
CREATE POLICY "Service role can update queue items"
  ON upload_queue FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for temporary upload files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'upload-queue',
  'upload-queue',
  false,
  5242880, -- 5MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for upload-queue bucket
CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'upload-queue' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'upload-queue' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'upload-queue' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to get queue statistics for a user
CREATE OR REPLACE FUNCTION get_queue_stats(user_id UUID)
RETURNS TABLE (
  total_count BIGINT,
  pending_count BIGINT,
  processing_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_count,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_count,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count
  FROM upload_queue
  WHERE client_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old completed/failed items (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete completed items older than 7 days
  WITH deleted AS (
    DELETE FROM upload_queue
    WHERE status IN ('completed', 'failed')
    AND completed_at < now() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE upload_queue IS 'Queue for background processing of bulk document uploads';
COMMENT ON COLUMN upload_queue.file_path IS 'Path in storage bucket: {client_id}/{filename}';
COMMENT ON COLUMN upload_queue.extracted_data IS 'JSON with extracted withholding data after OCR processing';
