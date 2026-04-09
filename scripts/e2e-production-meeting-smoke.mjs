#!/usr/bin/env node

import { execSync } from 'node:child_process';

if (!process.env.E2E_BASE_URL) {
  console.error('\n✗ E2E_BASE_URL is required for production smoke.\n');
  console.error('  Example:\n');
  console.error('  E2E_BASE_URL="https://your-production-url" npm run e2e:meeting:prod\n');
  process.exit(1);
}

const command = [
  'set -a',
  '[ -f ./.env ] && . ./.env',
  '[ -f ./.env.local ] && . ./.env.local',
  'set +a',
  'missing=""',
  'eval "auth_email=\\${DEMO_EMAIL:-\\${TEST_USER_EMAIL:-}}"',
  'eval "auth_password=\\${DEMO_PASSWORD:-\\${TEST_USER_PASSWORD:-}}"',
  'if [ -z "$auth_email" ]; then missing="$missing DEMO_EMAIL/TEST_USER_EMAIL"; fi',
  'if [ -z "$auth_password" ]; then missing="$missing DEMO_PASSWORD/TEST_USER_PASSWORD"; fi',
  'for v in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY E2E_BASE_URL; do',
  '  eval "val=\\${$v:-}"',
  '  if [ -z "$val" ]; then',
  '    missing="$missing $v"',
  '  fi',
  'done',
  'if [ -n "$missing" ]; then',
  '  echo ""',
  '  echo "✗ Missing env vars:$missing"',
  '  echo ""',
  '  exit 1',
  'fi',
  'npx playwright test e2e/meeting-regressions.prod.spec.ts --project=chromium --reporter=list',
].join('\n');

try {
  execSync(command, {
    stdio: 'inherit',
    shell: '/bin/zsh',
    env: { ...process.env },
  });
} catch {
  console.error('\n✗ Production meeting smoke failed.\n');
  process.exit(1);
}
