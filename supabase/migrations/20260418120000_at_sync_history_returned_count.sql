-- Add a raw count of invoices returned by AT SOAP, pre-dedup.
-- Differs from invoices_synced when all items were duplicates (skipped),
-- and is 0 when AT reported no activity for the queried period.
-- Used by decideSyncStatus() in sync-efatura to flag suspicious empty
-- runs as `partial` instead of silently `success`.

ALTER TABLE public.at_sync_history
  ADD COLUMN IF NOT EXISTS invoices_returned_by_at integer;

COMMENT ON COLUMN public.at_sync_history.invoices_returned_by_at IS
  'Raw invoice count returned by AT SOAP before dedup. NULL for rows written before this column existed. 0 with status=partial indicates a suspicious empty response (client has historical activity).';

-- Composite index to speed up dashboard queries that filter by
-- (reason_code, status) when surfacing partial/error runs.
CREATE INDEX IF NOT EXISTS idx_at_sync_history_reason_status
  ON public.at_sync_history (reason_code, status)
  WHERE status IN ('partial', 'error');
