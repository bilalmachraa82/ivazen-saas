/**
 * Tests for canonical document reference resolution.
 * 
 * The process-queue edge function must produce a single canonical
 * document_reference for deduplication. When AI extracts ATCUD instead
 * of the series reference, the filename is used as fallback.
 *
 * These test the pure functions extracted from process-queue logic.
 */
import { describe, it, expect } from 'vitest';

// ── Re-implement the 3 pure functions from process-queue for testing ──

function isAtcudFormat(ref: string): boolean {
  if (!ref) return false;
  const cleaned = ref.replace(/^ATCUD:/i, '').trim();
  return /^[A-Z0-9]{6,}-\d+$/i.test(cleaned);
}

function extractSeriesRefFromFilename(filename: string): string | null {
  if (!filename) return null;
  const match = filename.match(/_(FR|FT|FRI|FTI|RG|RGI)_(ATSIRE\d+\w+)_(\d+)_/i);
  if (match) return `${match[2]}/${match[3]}`;
  return null;
}

function normalizeDocumentReference(ref: string, isFilenameFallback = false): string {
  if (!ref) return ref;
  let normalized = ref.trim();
  normalized = normalized.replace(/^</, '').replace(/>$/, '').trim();
  const prefixes = ['FRI ', 'FTI ', 'RGI ', 'FR ', 'FT ', 'RG ', 'NC ', 'ND ', 'R ', 'F '];
  for (const prefix of prefixes) {
    if (normalized.toUpperCase().startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
      break;
    }
  }
  if (isFilenameFallback) {
    normalized = normalized.replace(/\s*\(\d+\)\s*$/, '');
    normalized = normalized.replace(/-c[oó]pia\d*$/i, '');
    normalized = normalized.replace(/-copy\d*$/i, '');
  }
  return normalized.trim();
}

// deno-lint-ignore no-explicit-any
function resolveCanonicalReference(extractedData: Record<string, any>, filename: string): string {
  const aiRef = extractedData.document_reference || '';
  const normalizedAiRef = normalizeDocumentReference(String(aiRef));

  if (normalizedAiRef.startsWith('ATSIRE')) {
    return normalizedAiRef;
  }

  if (isAtcudFormat(aiRef)) {
    const fromFilename = extractSeriesRefFromFilename(filename);
    if (fromFilename) {
      extractedData.atcud_original = aiRef;
      return fromFilename;
    }
    return normalizedAiRef;
  }

  const fromFilename = extractSeriesRefFromFilename(filename);
  if (fromFilename && !normalizedAiRef.startsWith('ATSIRE')) {
    extractedData.atcud_original = aiRef || undefined;
    return fromFilename;
  }

  if (normalizedAiRef) return normalizedAiRef;
  return normalizeDocumentReference(filename, true);
}

// ── TESTS ──

describe('isAtcudFormat', () => {
  it('detects standard ATCUD codes', () => {
    expect(isAtcudFormat('JJSBPRS7-22')).toBe(true);
    expect(isAtcudFormat('JJM5ZN9V-23')).toBe(true);
    expect(isAtcudFormat('J6JGSW42-16')).toBe(true);
    expect(isAtcudFormat('JJXN3F3R-102')).toBe(true);
  });

  it('detects ATCUD: prefixed codes', () => {
    expect(isAtcudFormat('ATCUD:JJXB72P7-23')).toBe(true);
    expect(isAtcudFormat('ATCUD:JJXN3F3R-102')).toBe(true);
  });

  it('rejects ATSIRE series references', () => {
    expect(isAtcudFormat('ATSIRE01FR/22')).toBe(false);
    expect(isAtcudFormat('FR ATSIRE01FR/1')).toBe(false);
  });

  it('rejects empty and invalid strings', () => {
    expect(isAtcudFormat('')).toBe(false);
    expect(isAtcudFormat('OUT - 66/2025-T')).toBe(false);
    expect(isAtcudFormat('some random text')).toBe(false);
  });
});

describe('extractSeriesRefFromFilename', () => {
  it('extracts FR series from standard filename', () => {
    expect(extractSeriesRefFromFilename('Recibo_Verde_508840309_FR_ATSIRE01FR_22_1659.pdf'))
      .toBe('ATSIRE01FR/22');
  });

  it('extracts FRI series', () => {
    expect(extractSeriesRefFromFilename('Recibo_Verde_508840309_FRI_ATSIRE01FRI_2_2146.pdf'))
      .toBe('ATSIRE01FRI/2');
  });

  it('extracts FTI series', () => {
    expect(extractSeriesRefFromFilename('Recibo_Verde_508840309_FTI_ATSIRE01FTI_1_2684.pdf'))
      .toBe('ATSIRE01FTI/1');
  });

  it('extracts RGI series', () => {
    expect(extractSeriesRefFromFilename('Recibo_Verde_508840309_RGI_ATSIRE01RGI_1_2565.pdf'))
      .toBe('ATSIRE01RGI/1');
  });

  it('extracts high series numbers', () => {
    expect(extractSeriesRefFromFilename('Recibo_Verde_508840309_FR_ATSIRE01FR_219_169.pdf'))
      .toBe('ATSIRE01FR/219');
  });

  it('returns null for non-matching filenames', () => {
    expect(extractSeriesRefFromFilename('invoice_12345.pdf')).toBeNull();
    expect(extractSeriesRefFromFilename('document.pdf')).toBeNull();
    expect(extractSeriesRefFromFilename('')).toBeNull();
  });
});

describe('normalizeDocumentReference', () => {
  it('strips FR prefix', () => {
    expect(normalizeDocumentReference('FR ATSIRE01FR/1')).toBe('ATSIRE01FR/1');
  });

  it('strips FRI prefix', () => {
    expect(normalizeDocumentReference('FRI ATSIRE01FRI/2')).toBe('ATSIRE01FRI/2');
  });

  it('strips FTI prefix', () => {
    expect(normalizeDocumentReference('FTI ATSIRE01FTI/1')).toBe('ATSIRE01FTI/1');
  });

  it('strips RGI prefix', () => {
    expect(normalizeDocumentReference('RGI ATSIRE01RGI/1')).toBe('ATSIRE01RGI/1');
  });

  it('strips angle brackets', () => {
    expect(normalizeDocumentReference('<ATSIRE01FR/22>')).toBe('ATSIRE01FR/22');
  });

  it('does not strip numeric suffixes from fiscal refs', () => {
    expect(normalizeDocumentReference('ATSIRE01FR/33')).toBe('ATSIRE01FR/33');
  });
});

describe('resolveCanonicalReference', () => {
  it('uses ATSIRE series when AI extracts it correctly', () => {
    const data = { document_reference: 'FR ATSIRE01FR/22' };
    const result = resolveCanonicalReference(data, 'Recibo_Verde_508840309_FR_ATSIRE01FR_22_1659.pdf');
    expect(result).toBe('ATSIRE01FR/22');
    expect(data.atcud_original).toBeUndefined();
  });

  it('replaces ATCUD with series ref from filename', () => {
    const data = { document_reference: 'JJSBPRS7-22' };
    const result = resolveCanonicalReference(data, 'Recibo_Verde_508840309_FR_ATSIRE01FR_22_1659.pdf');
    expect(result).toBe('ATSIRE01FR/22');
    expect(data.atcud_original).toBe('JJSBPRS7-22');
  });

  it('replaces ATCUD: prefixed with series ref from filename', () => {
    const data = { document_reference: 'ATCUD:JJXB72P7-23' };
    const result = resolveCanonicalReference(data, 'Recibo_Verde_508840309_FR_ATSIRE01FR_23_1942.pdf');
    expect(result).toBe('ATSIRE01FR/23');
    expect(data.atcud_original).toBe('ATCUD:JJXB72P7-23');
  });

  it('falls back to ATCUD when filename has no series info', () => {
    const data = { document_reference: 'JJSBPRS7-22' };
    const result = resolveCanonicalReference(data, 'invoice_12345.pdf');
    expect(result).toBe('JJSBPRS7-22');
    expect(data.atcud_original).toBeUndefined();
  });

  it('uses filename series when AI ref is non-standard', () => {
    const data = { document_reference: 'OUT - 66/2025-T' };
    const result = resolveCanonicalReference(data, 'Recibo_Verde_508840309_FR_ATSIRE01FR_12_999.pdf');
    expect(result).toBe('ATSIRE01FR/12');
    expect(data.atcud_original).toBe('OUT - 66/2025-T');
  });

  it('two different ATCUD codes for the same series produce same canonical ref', () => {
    // This is the exact bug case: same doc, AI extracts different ATCUD formats
    const data1 = { document_reference: 'JJSBPRS7-22' };
    const data2 = { document_reference: 'ATCUD:JJSBPRS7-22' };
    const data3 = { document_reference: 'FR ATSIRE01FR/22' };
    const filename = 'Recibo_Verde_508840309_FR_ATSIRE01FR_22_1659.pdf';

    const ref1 = resolveCanonicalReference(data1, filename);
    const ref2 = resolveCanonicalReference(data2, filename);
    const ref3 = resolveCanonicalReference(data3, filename);

    expect(ref1).toBe('ATSIRE01FR/22');
    expect(ref2).toBe('ATSIRE01FR/22');
    expect(ref3).toBe('ATSIRE01FR/22');
    // All three paths converge to the same canonical reference
    expect(ref1).toBe(ref2);
    expect(ref2).toBe(ref3);
  });

  it('handles FRI documents correctly', () => {
    const data = { document_reference: 'FRI ATSIRE01FRI/2' };
    const result = resolveCanonicalReference(data, 'Recibo_Verde_508840309_FRI_ATSIRE01FRI_2_2146.pdf');
    expect(result).toBe('ATSIRE01FRI/2');
  });

  it('falls back to filename when AI returns no reference', () => {
    const data = {};
    const result = resolveCanonicalReference(data, 'Recibo_Verde_508840309_FR_ATSIRE01FR_50_100.pdf');
    expect(result).toBe('ATSIRE01FR/50');
  });
});
