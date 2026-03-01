-- ============================================================
-- STEP 2: Create users with SAME UUIDs from Lovable Cloud
--
-- INSTRUCTIONS:
-- 1. Go to Lovable Cloud > Users tab
-- 2. For each user, note their UUID and email
-- 3. Add an INSERT statement below for each user
-- 4. Run this in Supabase SQL Editor
-- ============================================================

-- IMPORTANT: This uses the auth schema directly to preserve UUIDs.
-- Users will need to reset their passwords (send reset email after migration).

-- Example (replace with real data from Lovable Cloud):
-- INSERT INTO auth.users (
--   id, instance_id, email, encrypted_password, email_confirmed_at,
--   created_at, updated_at, role, aud, confirmation_token
-- ) VALUES (
--   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- UUID from Lovable
--   '00000000-0000-0000-0000-000000000000',  -- default instance
--   'user@example.com',                        -- email from Lovable
--   crypt('TempPassword123!', gen_salt('bf')), -- temporary password
--   now(),                                     -- mark as confirmed
--   now(), now(), 'authenticated', 'authenticated', ''
-- );

-- ============================================================
-- PASTE YOUR USERS BELOW (one INSERT per user):
-- ============================================================



-- ============================================================
-- After running this, verify:
SELECT id, email, created_at FROM auth.users ORDER BY created_at;
