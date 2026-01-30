-- Table to track client invitations created by accountants
CREATE TABLE public.client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_email TEXT NOT NULL,
  client_nif TEXT NOT NULL,
  client_name TEXT NOT NULL,
  company_name TEXT,
  magic_link_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- Accountants can view their own invitations
CREATE POLICY "Accountants can view own invitations"
ON public.client_invitations
FOR SELECT
USING (accountant_id = auth.uid());

-- Accountants can insert their own invitations
CREATE POLICY "Accountants can insert own invitations"
ON public.client_invitations
FOR INSERT
WITH CHECK (accountant_id = auth.uid() AND has_role(auth.uid(), 'accountant'::app_role));

-- Accountants can update their own invitations
CREATE POLICY "Accountants can update own invitations"
ON public.client_invitations
FOR UPDATE
USING (accountant_id = auth.uid());

-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
ON public.client_invitations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_client_invitations_accountant ON public.client_invitations(accountant_id);
CREATE INDEX idx_client_invitations_email ON public.client_invitations(client_email);