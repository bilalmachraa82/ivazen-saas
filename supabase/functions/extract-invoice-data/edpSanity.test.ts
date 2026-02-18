import { describe, expect, it } from 'vitest';
import { evaluateEdpFallbackSanity } from './edpSanity';

describe('evaluateEdpFallbackSanity', () => {
  it('accepts normal EDP correction (6.13 -> 8.98)', () => {
    const result = evaluateEdpFallbackSanity({
      previousTotalVat: 6.13,
      fullTotal: 8.98,
    });
    expect(result.isSane).toBe(true);
    expect(result.ratio).not.toBeNull();
    expect(result.ratioOk).toBe(true);
    expect(result.deltaOk).toBe(true);
  });

  it('rejects known overcount spike (6.13 -> 21.37)', () => {
    const result = evaluateEdpFallbackSanity({
      previousTotalVat: 6.13,
      fullTotal: 21.37,
    });
    expect(result.isSane).toBe(false);
    expect(result.ratio).not.toBeNull();
    expect(result.ratioOk).toBe(false);
  });

  it('accepts strong but valid correction (4.12 -> 8.64)', () => {
    const result = evaluateEdpFallbackSanity({
      previousTotalVat: 4.12,
      fullTotal: 8.64,
    });
    expect(result.isSane).toBe(true);
  });
});

