#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'supabase', 'config.toml');

if (!fs.existsSync(configPath)) {
  console.error(`[check-edge-auth] Missing config file: ${configPath}`);
  process.exit(1);
}

const config = fs.readFileSync(configPath, 'utf8');
const lines = config.split(/\r?\n/);

const targets = [];
let currentFunction = null;
for (const rawLine of lines) {
  const line = rawLine.trim();
  const section = line.match(/^\[functions\.([\w-]+)\]$/);
  if (section) {
    currentFunction = section[1];
    continue;
  }

  if (currentFunction && /^verify_jwt\s*=\s*false\s*$/.test(line)) {
    targets.push(currentFunction);
    currentFunction = null;
  }
}

const failures = [];
for (const fnName of targets) {
  const fnPath = path.join(repoRoot, 'supabase', 'functions', fnName, 'index.ts');
  if (!fs.existsSync(fnPath)) {
    failures.push({ fnName, reason: 'missing file', path: fnPath });
    continue;
  }

  const src = fs.readFileSync(fnPath, 'utf8');
  const hasAuthHeaderCheck = /Authorization|authorization/.test(src);
  const hasTokenValidation = /auth\.getUser\(|SUPABASE_SERVICE_ROLE_KEY|token\s*===|Unauthorized|Não autorizado|Token inválido/.test(src);

  if (!hasAuthHeaderCheck || !hasTokenValidation) {
    failures.push({
      fnName,
      reason: `insufficient manual guard (hasAuthHeaderCheck=${hasAuthHeaderCheck}, hasTokenValidation=${hasTokenValidation})`,
      path: fnPath,
    });
  }
}

if (failures.length > 0) {
  console.error('[check-edge-auth] FAILED. Functions with verify_jwt=false must implement manual auth guards.');
  for (const f of failures) {
    console.error(`- ${f.fnName}: ${f.reason} (${f.path})`);
  }
  process.exit(1);
}

console.log(`[check-edge-auth] OK (${targets.length} functions verified)`);
