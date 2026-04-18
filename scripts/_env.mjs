// Shared helper for diagnostic / migration scripts. Reads .env and returns
// an authenticated Supabase service-role client. Kept minimal so scripts can
// import it and drop any previously-hardcoded JWT.
//
// Usage:
//   import { getSupabaseClient } from './_env.mjs';
//   const supabase = getSupabaseClient();
//
// Resolution for SUPABASE_URL: `VITE_SUPABASE_URL` (falls back to
// `SUPABASE_URL`). Resolution for the key: `SUPABASE_SERVICE_KEY`
// (falls back to `SUPABASE_SERVICE_ROLE_KEY`).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export function loadEnv(envFile) {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = envFile ?? join(here, '..', '.env');
  const raw = readFileSync(path, 'utf8');
  return Object.fromEntries(
    raw
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [
          l.slice(0, i).trim(),
          l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
}

export function getSupabaseClient(envFile) {
  const env = loadEnv(envFile);
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing VITE_SUPABASE_URL and/or SUPABASE_SERVICE_KEY in .env',
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
