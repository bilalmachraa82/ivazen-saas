#!/usr/bin/env node
/**
 * Release-gate wrapper for smoke E2E.
 * Runs `playwright test e2e/smoke-demo.spec.ts` if credentials are available.
 * Exits 0 with a warning if credentials are missing (allows CI without secrets).
 */

const required = ['DEMO_EMAIL', 'DEMO_PASSWORD', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
const missing = required.filter((v) => !process.env[v]);

if (missing.length > 0) {
  console.log(`\n⚠  Smoke E2E skipped — missing env vars: ${missing.join(', ')}`);
  console.log('   Set these in .env or export them to enable the authenticated smoke test.\n');
  process.exit(0);
}

const { execSync } = await import('node:child_process');

try {
  execSync(
    'npx playwright test e2e/smoke-demo.spec.ts --project=chromium --reporter=list',
    { stdio: 'inherit', env: { ...process.env } },
  );
} catch {
  console.error('\n✗ Smoke E2E failed — release gate blocked.\n');
  process.exit(1);
}
