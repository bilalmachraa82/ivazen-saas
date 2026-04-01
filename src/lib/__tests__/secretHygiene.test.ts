import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const hardcodedSecretPattern = /eyJhbGciOiJIUzI1Ni/;
const files = [
  'scripts/fix-audit-data.mjs',
  'scripts/fix-audit-data-v2.mjs',
  'scripts/fix-audit-data-v3.mjs',
  'scripts/try-vendas-sync.mjs',
];

describe('Secret hygiene', () => {
  it('does not keep hardcoded Supabase service-role JWTs in tracked scripts', () => {
    const offenders = files.filter((file) => {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      return hardcodedSecretPattern.test(source);
    });

    expect(offenders).toEqual([]);
  });
});
