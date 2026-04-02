-- Nightly VIES supplier enrichment (02:30 UTC = 03:30 Lisbon)
-- Enriches 50 business NIFs per call via EU VIES API (free, no key needed)
SELECT cron.schedule(
  'nightly-vies-enrichment',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/enrich-supplier-vies',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Nightly classification backfill (every 15 min from 03:00-05:45 UTC)
-- Phase 1: rules-only (free), Phase 2: AI via Google free tier, Phase 3: sales
SELECT cron.schedule(
  'nightly-classify-backfill',
  '*/15 3-5 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/nightly-classify',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
