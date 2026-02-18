export interface EdpFallbackSanityResult {
  isSane: boolean;
  deltaAbs: number;
  ratio: number | null;
  ratioOk: boolean;
  deltaOk: boolean;
}

/**
 * Guardrail to reject EDP fallback overcounts caused by duplicated/irrelevant sections.
 * Accepts normal corrections while blocking extreme jumps (e.g. 6.13 -> 21.37).
 */
export function evaluateEdpFallbackSanity(input: {
  previousTotalVat: number;
  fullTotal: number;
}): EdpFallbackSanityResult {
  const previousTotalVat = Number.isFinite(input.previousTotalVat) ? input.previousTotalVat : 0;
  const fullTotal = Number.isFinite(input.fullTotal) ? input.fullTotal : 0;

  const deltaAbs = Math.abs(fullTotal - previousTotalVat);
  const ratio = previousTotalVat > 0 ? fullTotal / previousTotalVat : null;

  // Ratio is intentionally bounded to reject overcount spikes.
  const ratioOk = ratio === null ? fullTotal <= 25 : ratio >= 0.45 && ratio <= 2.6;
  const deltaOk = previousTotalVat <= 0 ? true : deltaAbs <= 8;
  const isSane = fullTotal > 0.5 && ratioOk && deltaOk;

  return { isSane, deltaAbs, ratio, ratioOk, deltaOk };
}

