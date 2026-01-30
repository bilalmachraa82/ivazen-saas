-- Create upload_queue table for background uploads
CREATE TABLE public.upload_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_data TEXT NOT NULL,
  qr_content TEXT,
  upload_type TEXT NOT NULL DEFAULT 'expense',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.upload_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for upload_queue
CREATE POLICY "Users can view own uploads" ON public.upload_queue
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own uploads" ON public.upload_queue
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own uploads" ON public.upload_queue
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own uploads" ON public.upload_queue
  FOR DELETE USING (user_id = auth.uid());

-- Create user_onboarding_progress table
CREATE TABLE public.user_onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  completed_steps TEXT[] NOT NULL DEFAULT '{}',
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_onboarding_progress
CREATE POLICY "Users can view own progress" ON public.user_onboarding_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own progress" ON public.user_onboarding_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress" ON public.user_onboarding_progress
  FOR UPDATE USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_user_onboarding_progress_updated_at
  BEFORE UPDATE ON public.user_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_upload_queue_user_id ON public.upload_queue(user_id);
CREATE INDEX idx_upload_queue_status ON public.upload_queue(status);
CREATE INDEX idx_user_onboarding_progress_user_id ON public.user_onboarding_progress(user_id);