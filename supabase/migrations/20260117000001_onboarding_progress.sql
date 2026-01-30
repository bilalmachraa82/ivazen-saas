-- Create table for tracking user onboarding progress
CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  step_id TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, step_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_user ON public.user_onboarding_progress(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and manage their own onboarding progress
CREATE POLICY "Users can view their own onboarding progress"
  ON public.user_onboarding_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding progress"
  ON public.user_onboarding_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding progress"
  ON public.user_onboarding_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_onboarding_progress TO authenticated;
