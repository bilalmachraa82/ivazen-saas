-- Add missing columns to upload_queue for background processing
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS extracted_data jsonb;
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS confidence float;
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS warnings text[];
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS fiscal_year integer DEFAULT 2025;
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS started_at timestamptz;