import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const hardcodedSecretPattern = /eyJhbGciOiJIUzI1Ni/;

describe('Secret hygiene', () => {
  it('does not keep hardcoded Supabase service-role JWTs in tracked scripts', () => {
    const tracked = execSync('git ls-files scripts/*.mjs scripts/*.js scripts/*.ts', {
      encoding: 'utf8',
      cwd: process.cwd(),
    }).trim().split('\n').filter(Boolean);

    const offenders = tracked.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return hardcodedSecretPattern.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
