-- SECURITY FIX: Restrict sent_notifications INSERT policy
-- Previously allowed any authenticated user to insert notifications for any user
-- Now restricts to service_role only (for edge functions/backend use)

DROP POLICY IF EXISTS "System can insert sent notifications" ON public.sent_notifications;

CREATE POLICY "Service role can insert sent notifications"
ON public.sent_notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow authenticated users to insert ONLY for themselves (edge case for self-notifications)
CREATE POLICY "Users can insert own notifications"
ON public.sent_notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());