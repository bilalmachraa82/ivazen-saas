-- Drop the old status check constraint
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add new constraint with 'classified' status included
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'classified'::text, 'validated'::text, 'rejected'::text]));