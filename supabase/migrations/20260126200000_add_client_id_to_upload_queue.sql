-- Add client_id column to upload_queue for accountant workflow
-- user_id = who uploaded the file (accountant or user)
-- client_id = who the withholding belongs to (the actual client)

-- Add client_id column (nullable for backwards compatibility, defaults to user_id)
ALTER TABLE upload_queue ADD COLUMN IF NOT EXISTS client_id UUID;

-- Set default value for existing rows (client_id = user_id)
UPDATE upload_queue SET client_id = user_id WHERE client_id IS NULL;

-- Make it NOT NULL after setting defaults
ALTER TABLE upload_queue ALTER COLUMN client_id SET NOT NULL;

-- Add index for efficient querying by client
CREATE INDEX IF NOT EXISTS idx_upload_queue_client_id ON upload_queue(client_id);

-- Update the process-queue function comment
COMMENT ON COLUMN upload_queue.client_id IS 'The client ID for whom the withholding is being created (may differ from user_id for accountants)';
