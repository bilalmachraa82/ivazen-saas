-- Job queue table for background AT synchronization
CREATE TABLE public.at_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  error_message text,
  invoices_synced integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  job_batch_id uuid -- groups jobs from same "Sync All" action
);

-- Indexes for efficient queue processing
CREATE INDEX idx_sync_jobs_pending ON public.at_sync_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_sync_jobs_batch ON public.at_sync_jobs(job_batch_id) WHERE job_batch_id IS NOT NULL;
CREATE INDEX idx_sync_jobs_accountant ON public.at_sync_jobs(accountant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.at_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Accountants can view their own jobs
CREATE POLICY "Accountants can view own sync jobs"
ON public.at_sync_jobs FOR SELECT
USING (accountant_id = auth.uid());

-- Accountants can create jobs for their clients
CREATE POLICY "Accountants can create sync jobs"
ON public.at_sync_jobs FOR INSERT
WITH CHECK (
  accountant_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM client_accountants ca 
    WHERE ca.client_id = at_sync_jobs.client_id 
    AND ca.accountant_id = auth.uid()
  )
);

-- Only service role can update (from Edge Functions)
CREATE POLICY "Service role can update sync jobs"
ON public.at_sync_jobs FOR UPDATE
USING (true)
WITH CHECK (true);

-- Batch progress view for efficient UI polling
CREATE OR REPLACE FUNCTION public.get_sync_batch_progress(p_batch_id uuid)
RETURNS TABLE(
  total integer,
  pending integer,
  processing integer,
  completed integer,
  errors integer,
  total_invoices integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*)::integer as total,
    COUNT(*) FILTER (WHERE status = 'pending')::integer as pending,
    COUNT(*) FILTER (WHERE status = 'processing')::integer as processing,
    COUNT(*) FILTER (WHERE status = 'completed')::integer as completed,
    COUNT(*) FILTER (WHERE status = 'error')::integer as errors,
    COALESCE(SUM(invoices_synced), 0)::integer as total_invoices
  FROM at_sync_jobs
  WHERE job_batch_id = p_batch_id;
$$;