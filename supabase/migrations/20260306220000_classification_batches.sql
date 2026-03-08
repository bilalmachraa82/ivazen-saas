-- Classification batch tracking table
CREATE TABLE IF NOT EXISTS public.classification_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_type TEXT NOT NULL DEFAULT 'purchase'
    CHECK (batch_type IN ('purchase', 'sales', 'withholding')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'paused', 'error')),
  cursor_position UUID,
  total_target INTEGER NOT NULL DEFAULT 0,
  total_processed INTEGER NOT NULL DEFAULT 0,
  total_classified INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  total_review INTEGER NOT NULL DEFAULT 0,
  chunk_size INTEGER NOT NULL DEFAULT 200,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only service role can access (no user-facing)
ALTER TABLE public.classification_batches ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (bypasses RLS by default)
-- No user policies needed — this is an internal operations table
