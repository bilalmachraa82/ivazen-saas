-- Update partners table policy to require authentication for viewing
DROP POLICY IF EXISTS "Anyone can view active partners" ON public.partners;

CREATE POLICY "Authenticated users can view active partners" 
ON public.partners 
FOR SELECT 
USING (is_active = true AND auth.uid() IS NOT NULL);