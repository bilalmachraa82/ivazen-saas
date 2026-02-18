-- DUPLICATE: user_onboarding_progress already created in 20260116155600
-- This migration had a conflicting schema (step_id vs completed_steps).
-- Made idempotent - all operations use IF NOT EXISTS / DROP IF EXISTS.

CREATE TABLE IF NOT EXISTS public.user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  step_id TEXT NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user ON public.user_onboarding_progress(user_id);

ALTER TABLE public.user_onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can view their own onboarding progress"
  ON public.user_onboarding_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can insert their own onboarding progress"
  ON public.user_onboarding_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own onboarding progress" ON public.user_onboarding_progress;
CREATE POLICY "Users can update their own onboarding progress"
  ON public.user_onboarding_progress FOR UPDATE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_onboarding_progress TO authenticated;
