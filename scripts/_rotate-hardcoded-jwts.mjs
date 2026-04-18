#!/usr/bin/env node
// Rotates any scripts/*.mjs that hardcode the service-role JWT to import
// getSupabaseClient from scripts/_env.mjs. Handles two layouts:
//   (a) inline createClient('https://…', 'eyJ…', { … })
//   (b) const SUPABASE_URL=…; const SUPABASE_SERVICE_KEY=…; createClient(…)
// Idempotent. Files that don't contain the JWT fragment are skipped.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = join(ROOT, 'scripts');
// Match the concrete legacy JWT prefix. Keep this narrow — don't catch stray docs.
const JWT_RE =
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcHJrZHZrenpqdGl4bGF0bmx4[A-Za-z0-9_\-.]+/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const s = statSync(path);
    if (s.isDirectory()) yield* walk(path);
    else if (path.endsWith('.mjs') || path.endsWith('.js')) yield path;
  }
}

let changed = 0;
for (const file of walk(SCRIPTS)) {
  if (file.endsWith('/_env.mjs') || file.endsWith('/_rotate-hardcoded-jwts.mjs')) continue;
  const src = readFileSync(file, 'utf8');
  if (!JWT_RE.test(src)) continue;

  const relImport = relative(dirname(file), join(SCRIPTS, '_env.mjs')).replace(/\\/g, '/');
  const importPath = relImport.startsWith('.') ? relImport : `./${relImport}`;

  // Replacement strategy: (1) drop the hardcoded URL and JWT literals entirely,
  // (2) drop any lone `const SUPABASE_URL=…` / `const SUPABASE_(SERVICE_)?KEY=…`,
  // (3) drop the `import { createClient } from '@supabase/supabase-js';` line,
  // (4) drop any `const <name> = createClient(…);` line (first one only, typical),
  // (5) prepend the _env import + a single `const supabase = getSupabaseClient();`.

  let patched = src;
  patched = patched.replace(JWT_RE, '__REDACTED_LEGACY_JWT__');
  patched = patched.replace(
    /^\s*const\s+SUPABASE_URL\s*=\s*['"][^'"]+supabase\.co['"];\s*\n/m,
    '',
  );
  patched = patched.replace(
    /^\s*const\s+(SUPABASE_SERVICE_KEY|SUPABASE_KEY|SERVICE_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*['"]__REDACTED_LEGACY_JWT__['"];\s*\n/m,
    '',
  );
  patched = patched.replace(
    /^\s*import\s*\{\s*createClient\s*\}\s*from\s*['"]@supabase\/supabase-js['"];?\s*\n/m,
    '',
  );
  patched = patched.replace(
    /^\s*const\s+\w+\s*=\s*createClient\(\s*(?:SUPABASE_URL|['"][^'"]+['"])\s*,\s*(?:\w+|['"]__REDACTED_LEGACY_JWT__['"])\s*(?:,\s*\{[^}]*\})?\s*\);\s*\n/m,
    '',
  );

  // Drop any stale reference to a deleted identifier or leftover redaction.
  if (patched.includes('__REDACTED_LEGACY_JWT__') || patched.includes('createClient(')) {
    console.log(`SKIP (non-standard shape) ${relative(ROOT, file)}`);
    continue;
  }

  // Prepend the import + client line.
  // Find the first import or the top of the file.
  const prefix = `import { getSupabaseClient } from '${importPath}';\nconst supabase = getSupabaseClient();\n`;
  if (/^#!/.test(patched)) {
    patched = patched.replace(/^(#![^\n]*\n)/, `$1${prefix}`);
  } else {
    patched = prefix + patched;
  }

  writeFileSync(file, patched);
  console.log(`patched ${relative(ROOT, file)}`);
  changed++;
}
console.log(`\ndone — ${changed} files patched`);
