import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Validation runtime guards', () => {
  it('does not mount the blocking legacy onboarding modal in the compras workflow', () => {
    const validationSource = readRepoFile('src/pages/Validation.tsx');

    expect(validationSource).not.toContain("import { OnboardingTour }");
    expect(validationSource).not.toContain('<OnboardingTour />');
  });
});
