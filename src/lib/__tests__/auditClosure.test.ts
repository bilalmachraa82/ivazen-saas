import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const jwtPrefixLiteral = ['eyJ', 'hbGci', 'OiJIUzI1Ni'].join('');

describe('audit closure regressions', () => {
  it('keeps landing copy free from hard measured claims', () => {
    const landingSource = readRepoFile('src/pages/Landing.tsx');
    const bannedClaims = [
      '70% do tempo',
      'já poupam 70%',
      'value: "70%"',
      'value: "<5s"',
      'value: "99%"',
      'value: "100%"',
      'QR Code PT • <5s',
      'Few-Shot Learning • 98%',
      '"98% precisão"',
    ];

    for (const claim of bannedClaims) {
      expect(landingSource).not.toContain(claim);
    }
  });

  it('does not keep the JWT prefix literal in tracked test source', () => {
    const secretHygieneSource = readRepoFile('src/lib/__tests__/secretHygiene.test.ts');
    expect(secretHygieneSource).not.toContain(jwtPrefixLiteral);
  });
});
