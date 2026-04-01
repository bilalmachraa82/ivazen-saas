import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Edge function shared auth policy', () => {
  it('imports the shared auth module from every edge function entrypoint', () => {
    const functionsDir = path.join(process.cwd(), 'supabase', 'functions');
    const missing = fs.readdirSync(functionsDir)
      .filter((name) => name !== '_shared')
      .filter((name) => {
        const entrypoint = path.join(functionsDir, name, 'index.ts');
        const source = fs.readFileSync(entrypoint, 'utf8');
        return !source.includes('../_shared/auth.ts');
      });

    expect(missing).toEqual([]);
  });
});
