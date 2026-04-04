/**
 * Shared classification helpers for invoice classification edge functions.
 *
 * Used by: classify-invoice, nightly-classify.
 */

/** Normalize a supplier NIF/VAT ID for rule lookup. */
export function normalizeSupplierTaxId(raw: string): string | null {
  const s = (raw || "").trim().toUpperCase();
  if (!s) return null;

  const alnum = s.replace(/[^A-Z0-9]/g, "");

  // PT VAT: "PT123456789" → 9 digits
  if (/^PT\d{9}$/.test(alnum)) return alnum.slice(2);

  // PT NIF: 9 digits
  if (/^\d{9}$/.test(alnum)) return alnum;

  // Foreign VAT ID: 2-letter country prefix + alphanumerics
  if (/^[A-Z]{2}[A-Z0-9]{2,}$/.test(alnum)) return alnum;

  return null;
}

/**
 * Only these supplier NIFs are safe for cross-client rule reuse.
 * Utilities/telecoms where classification is buyer-independent (Art. 20-21-23 CIVA).
 */
export const SAFE_GLOBAL_NIFS = new Set([
  // Electricity
  "503504564", // EDP Comercial
  "504172577", // EDP Serviço Universal
  "503207430", // Endesa
  "509534401", // Iberdrola
  "513445311", // Galp Power
  "509846830", // Goldenergy
  "510329490", // SU Electricidade
  // Water
  "504812578", // Vimagua
  "504075156", // Águas do Porto
  "500077568", // EPAL
  // Gas
  "503474705", // Lisboagás
  // Telecoms
  "504453513", // NOS
  "500019020", // MEO/PT
  "502530830", // Vodafone
  "505280740", // NOWO
  "517424334", // Digi
]);
