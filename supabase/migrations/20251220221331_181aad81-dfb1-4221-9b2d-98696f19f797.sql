-- Create table for withholding change history
CREATE TABLE public.withholding_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  withholding_id UUID NOT NULL REFERENCES public.tax_withholdings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  changes JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.withholding_logs ENABLE ROW LEVEL SECURITY;

-- Users can view logs for their own withholdings
CREATE POLICY "Users can view own withholding logs" 
ON public.withholding_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tax_withholdings tw 
    WHERE tw.id = withholding_id 
    AND tw.client_id = auth.uid()
  )
);

-- Users can insert logs for their own withholdings
CREATE POLICY "Users can insert own withholding logs" 
ON public.withholding_logs 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_withholding_logs_withholding_id ON public.withholding_logs(withholding_id);
CREATE INDEX idx_withholding_logs_created_at ON public.withholding_logs(created_at DESC);