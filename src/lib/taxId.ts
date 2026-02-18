function slugify(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 48);
}

/**
 * Normalizes supplier tax identifiers coming from OCR/LLM extraction.
 * - Accepts PT NIF (9 digits), optionally with "PT" prefix or whitespace.
 * - Accepts foreign VAT IDs (e.g., IE3668997OH) as-is (uppercased, spaces removed).
 * - If missing, returns a deterministic temporary identifier based on name/doc number.
 */
export function normalizeSupplierTaxId(input: {
  taxId: unknown;
  supplierName?: unknown;
  documentNumber?: unknown;
}): string {
  const raw = typeof input.taxId === 'string' ? input.taxId.trim() : '';

  if (raw) {
    const upper = raw.toUpperCase();

    // Common: "PT 123456789"
    const ptMatch = upper.match(/^PT\s*([0-9]{9})$/);
    if (ptMatch) return ptMatch[1];

    // Common OCR: "150 798 369" or "150.798.369"
    const digits = upper.replace(/\D/g, '');
    if (digits.length === 9) return digits;

    // Foreign VAT (or unknown format): keep as text, but remove spaces.
    return upper.replace(/\s+/g, '');
  }

  const name = typeof input.supplierName === 'string' ? input.supplierName.trim() : '';
  const doc = typeof input.documentNumber === 'string' ? input.documentNumber.trim() : '';
  const seed = name || doc || 'UNKNOWN';
  const slug = slugify(seed);
  return `SEM-NIF-${slug || 'UNKNOWN'}`;
}

export function isTemporarySupplierTaxId(value: string): boolean {
  return (value || '').startsWith('SEM-NIF-');
}

/**
 * Normalizes foreign VAT IDs (EU/non-PT) so we can store and display them consistently.
 * Returns null for PT NIF-like values.
 */
export function normalizeSupplierVatId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!compact) return null;

  const normalized = compact.replace(/[^A-Z0-9]/g, '');
  if (!normalized) return null;

  // Not a foreign VAT: PT NIF (with or without PT prefix)
  if (/^\d{9}$/.test(normalized)) return null;
  if (/^PT\d{9}$/.test(normalized)) return null;

  // Typical VAT: 2-letter country code + alphanum
  if (!/^[A-Z]{2}[A-Z0-9]{2,}$/.test(normalized)) return null;
  return normalized;
}
