/**
 * End-to-end Modelo 10 pipeline test
 *
 * Validates the full flow:
 *   AT SIRE CSV → parseInvoiceFile → sales_invoices shape
 *   → detect-withholding-candidates logic → at_withholding_candidates
 *   → tax_withholdings (Modelo 10)
 *
 * Uses realistic Portuguese fiscal data with actual withholding amounts.
 */
import { describe, it, expect } from 'vitest';
import { parseInvoiceFile, ParsedInvoice } from '../csvParser';

// ---- helpers mirroring edge function logic ----

function parseExplicitWithholdingFromNotes(notes: string | null): number | null {
  if (!notes) return null;
  const match = notes.match(/AT_SIRE_WITHHOLDING=([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

const WITHHOLDING_RATES: Record<number, number> = { 2024: 25.0, 2025: 23.0, 2026: 23.0 };
const DEFAULT_RATE = 23.0;

interface SalesInvoiceRow {
  client_id: string;
  supplier_nif: string;
  document_date: string;
  document_number: string;
  customer_nif: string | null;
  customer_name: string | null;
  total_amount: number;
  total_vat: number;
  base_standard: number | null;
  base_exempt: number | null;
  document_type: string;
  fiscal_period: string;
  revenue_category: string | null;
  atcud: string | null;
  status: string;
  image_path: string;
  notes: string;
}

interface WithholdingCandidate {
  client_id: string;
  source_sales_invoice_id: string;
  fiscal_year: number;
  payment_date: string;
  document_reference: string;
  beneficiary_nif: string;
  income_category: string;
  gross_amount: number;
  withholding_amount: number;
  withholding_rate: number;
  confidence_score: number;
  detection_reason: string;
  detected_keys: string[];
  status: string;
}

// Simulates useSocialSecurity.tsx createSalesInvoicesMutation shape
function buildSalesInvoiceRow(
  invoice: ParsedInvoice,
  clientId: string,
  clientNif: string,
  category: string | null,
): SalesInvoiceRow {
  const explicitWithholding = Number(invoice.withholdingAmount || 0);
  return {
    client_id: clientId,
    supplier_nif: clientNif,
    document_date: invoice.date.toISOString().split('T')[0],
    document_number: invoice.documentNumber,
    customer_nif: invoice.customerNif || null,
    customer_name: invoice.supplierName || null,
    total_amount: invoice.totalValue,
    total_vat: invoice.vatValue,
    base_standard: invoice.vatValue > 0 ? invoice.baseValue : null,
    base_exempt: invoice.vatValue > 0 ? null : invoice.baseValue,
    document_type: invoice.documentType || 'FT',
    fiscal_period: invoice.quarter,
    revenue_category: category,
    atcud: invoice.atcud || null,
    status: 'validated',
    image_path: `imported/${
      invoice.sourceSystem === 'at_sire' ? 'at_faturas_recibos' : 'saft'
    }_${Date.now()}.json`,
    notes:
      invoice.sourceSystem === 'at_sire'
        ? `Importado de Faturas e Recibos AT (CSV); AT_SIRE_WITHHOLDING=${explicitWithholding.toFixed(2)}`
        : 'Importado do SAF-T',
  };
}

// Simulates detect-withholding-candidates edge function core logic
function detectWithholdingCandidate(
  inv: SalesInvoiceRow,
  invId: string,
): WithholdingCandidate | null {
  const customerNif = (inv.customer_nif || '').trim();
  if (!customerNif || !customerNif.startsWith('5')) return null;

  const totalAmount = inv.total_amount;
  const totalVat = inv.total_vat;
  const baseExempt = Number(inv.base_exempt) || 0;

  let baseAmount: number;
  if (totalVat > 0.01) {
    baseAmount = totalAmount - totalVat;
  } else if (baseExempt > 0.01) {
    baseAmount = baseExempt;
  } else {
    baseAmount = totalAmount;
  }

  if (baseAmount <= 0) return null;

  const docYear = new Date(inv.document_date).getFullYear();
  const explicitWithholding = parseExplicitWithholdingFromNotes(inv.notes);

  if (explicitWithholding !== null && explicitWithholding <= 0.009) return null;

  const fallbackRate = WITHHOLDING_RATES[docYear] || DEFAULT_RATE;
  const withholdingAmount =
    explicitWithholding !== null
      ? explicitWithholding
      : Math.round(baseAmount * (fallbackRate / 100) * 100) / 100;
  const rate =
    explicitWithholding !== null && baseAmount > 0
      ? Math.round((withholdingAmount / baseAmount) * 10000) / 100
      : fallbackRate;

  let confidence = 70;
  if (customerNif.length === 9) confidence += 10;
  if (inv.customer_name) confidence += 5;
  if (inv.document_number) confidence += 5;
  if (inv.document_date) confidence += 5;
  if (totalVat > 0) confidence += 5;
  if (explicitWithholding !== null) confidence += 10;
  confidence = Math.min(confidence, 95);

  return {
    client_id: inv.client_id,
    source_sales_invoice_id: invId,
    fiscal_year: docYear,
    payment_date: inv.document_date,
    document_reference: inv.document_number || `FR-${invId.slice(0, 8)}`,
    beneficiary_nif: inv.supplier_nif,
    income_category: 'B',
    gross_amount: baseAmount,
    withholding_amount: withholdingAmount,
    withholding_rate: rate,
    confidence_score: confidence,
    detection_reason:
      explicitWithholding !== null
        ? `AT explicit withholding imported from sales invoice note (${withholdingAmount.toFixed(2)} EUR)`
        : `Auto-detected: FR/FS to empresa (NIF ${customerNif}), Cat B ${rate}%`,
    detected_keys:
      explicitWithholding !== null
        ? ['source:at_sire', 'withholding:explicit', `customer_nif:${customerNif.slice(0, 3)}***`]
        : ['document_type:FR', `customer_nif:${customerNif.slice(0, 3)}***`],
    status: 'pending',
  };
}

// ---- realistic AT SIRE CSV fixture ----

// Scenario: freelancer NIF 232945993 issued 4 invoices in 2025:
//   FR to empresa 518326390 — 1000 base, 0 IVA (exempt), 230 withholding (23%)
//   FT to empresa 503998680 — 2000 base, 460 IVA (23%), 0 withholding
//   FR to particular 218945321 — 500 base, 0 IVA, 0 withholding (not empresa)
//   FR to empresa 509123456 — 750 base, 0 IVA, 172.50 withholding (23%)
const REALISTIC_CSV = [
  '\uFEFFReferência;Tipo Documento;ATCUD;Situação;Data da Transação;Motivo Emissão;Data de Emissão;País do Adquirente;NIF Adquirente;Nome do Adquirente;Valor Tributável (em euros);Valor do IVA (em euros);Imposto do Selo como Retenção na Fonte;Valor do Imposto do Selo (em euros);Valor do IRS (em euros);Total de Impostos (em euros);Total com Impostos (em euros);Total de Retenções na Fonte (em euros);Contribuição Cultura (em euros);Total do Documento (em euros)',
  'FR ATSIRE01FR/30;Fatura-Recibo;KK11ABCD-30;Emitido;2025-03-15;Pagamento dos bens ou dos serviços;2025-03-15;PORTUGAL;518326390;BRILHANTENTUSIASMO UNIPESSOAL LDA;1000;0;;0;0;;1000;230;0;1000',
  'FT ATSIRE01FT/31;Fatura;KK22EFGH-31;Emitido;2025-06-20;Pagamento dos bens ou dos serviços;2025-06-20;PORTUGAL;503998680;GOODBARBER LTD;2000;460;;0;0;460;2460;0;0;2460',
  'FR ATSIRE01FR/32;Fatura-Recibo;KK33IJKL-32;Emitido;2025-09-10;Pagamento dos bens ou dos serviços;2025-09-10;PORTUGAL;218945321;JOÃO SILVA;500;0;;0;0;;500;0;0;500',
  'FR ATSIRE01FR/33;Fatura-Recibo;KK44MNOP-33;Emitido;2025-11-25;Pagamento dos bens ou dos serviços;2025-11-25;PORTUGAL;509123456;DIGITAL FACTORY SA;750;0;;0;0;;750;172,50;0;750',
].join('\n');

const CLIENT_ID = '5a994a12-8364-4320-ac35-e93f81edcf10';
const CLIENT_NIF = '232945993';

describe('Modelo 10 end-to-end pipeline', () => {
  let parsed: ReturnType<typeof parseInvoiceFile>;

  it('Step 1: parseInvoiceFile correctly parses AT SIRE CSV with withholding', () => {
    parsed = parseInvoiceFile(REALISTIC_CSV, 'ListaRecibos_Bilal_2025.csv');

    expect(parsed.errors).toEqual([]);
    // Should have 3 invoices (FR/30, FT/31, FR/32, FR/33) — no RG/cancelled
    expect(parsed.invoices).toHaveLength(4);

    // FR/30: 1000 base, 0 IVA, 230 withholding
    const fr30 = parsed.invoices.find((i) => i.documentNumber.includes('FR/30'));
    expect(fr30).toBeDefined();
    expect(fr30!.baseValue).toBe(1000);
    expect(fr30!.vatValue).toBe(0);
    expect(fr30!.totalValue).toBe(1000);
    expect(fr30!.withholdingAmount).toBe(230);
    expect(fr30!.customerNif).toBe('518326390');
    expect(fr30!.sourceSystem).toBe('at_sire');
    expect(fr30!.atcud).toBe('KK11ABCD-30');
    expect(fr30!.documentType).toBe('FR');

    // FT/31: 2000 base, 460 IVA, 0 withholding
    const ft31 = parsed.invoices.find((i) => i.documentNumber.includes('FT/31'));
    expect(ft31).toBeDefined();
    expect(ft31!.baseValue).toBe(2000);
    expect(ft31!.vatValue).toBe(460);
    expect(ft31!.totalValue).toBe(2460);
    expect(ft31!.withholdingAmount).toBe(0);

    // FR/33: 750 base, 172.50 withholding (Portuguese comma decimal)
    const fr33 = parsed.invoices.find((i) => i.documentNumber.includes('FR/33'));
    expect(fr33).toBeDefined();
    expect(fr33!.baseValue).toBe(750);
    expect(fr33!.withholdingAmount).toBe(172.5);
  });

  it('Step 2: sales_invoices rows have correct shape and AT_SIRE_WITHHOLDING in notes', () => {
    const rows = parsed.invoices.map((inv) =>
      buildSalesInvoiceRow(inv, CLIENT_ID, CLIENT_NIF, 'prestacao_servicos'),
    );

    expect(rows).toHaveLength(4);

    // FR/30 — withholding 230
    const row30 = rows.find((r) => r.document_number.includes('FR/30'))!;
    expect(row30.supplier_nif).toBe(CLIENT_NIF);
    expect(row30.customer_nif).toBe('518326390');
    expect(row30.total_amount).toBe(1000);
    expect(row30.total_vat).toBe(0);
    expect(row30.base_exempt).toBe(1000); // no VAT → base_exempt
    expect(row30.base_standard).toBeNull();
    expect(row30.document_type).toBe('FR');
    expect(row30.notes).toContain('AT_SIRE_WITHHOLDING=230.00');
    expect(row30.atcud).toBe('KK11ABCD-30');
    expect(row30.status).toBe('validated');

    // FT/31 — withholding 0
    const row31 = rows.find((r) => r.document_number.includes('FT/31'))!;
    expect(row31.total_amount).toBe(2460);
    expect(row31.total_vat).toBe(460);
    expect(row31.base_standard).toBe(2000); // has VAT → base_standard
    expect(row31.base_exempt).toBeNull();
    expect(row31.notes).toContain('AT_SIRE_WITHHOLDING=0.00');

    // FR/33 — withholding 172.50
    const row33 = rows.find((r) => r.document_number.includes('FR/33'))!;
    expect(row33.notes).toContain('AT_SIRE_WITHHOLDING=172.50');
  });

  it('Step 3: withholding detector creates candidates only for empresas with withholding > 0', () => {
    const rows = parsed.invoices.map((inv) =>
      buildSalesInvoiceRow(inv, CLIENT_ID, CLIENT_NIF, 'prestacao_servicos'),
    );

    const candidates: WithholdingCandidate[] = [];
    for (const row of rows) {
      const candidate = detectWithholdingCandidate(row, `fake-id-${row.document_number}`);
      if (candidate) candidates.push(candidate);
    }

    // FR/30 (empresa 518..., withholding 230) → CANDIDATE
    // FT/31 (empresa 503..., withholding 0 explicit) → SKIPPED (explicit zero)
    // FR/32 (particular 218...) → SKIPPED (NIF doesn't start with 5)
    // FR/33 (empresa 509..., withholding 172.50) → CANDIDATE
    expect(candidates).toHaveLength(2);

    // Validate FR/30 candidate
    const c30 = candidates.find((c) => c.document_reference.includes('FR/30'))!;
    expect(c30).toBeDefined();
    expect(c30.beneficiary_nif).toBe(CLIENT_NIF);
    expect(c30.income_category).toBe('B');
    expect(c30.gross_amount).toBe(1000); // base_exempt = 1000
    expect(c30.withholding_amount).toBe(230);
    expect(c30.withholding_rate).toBe(23); // 230/1000 = 23%
    expect(c30.fiscal_year).toBe(2025);
    expect(c30.payment_date).toBe('2025-03-15');
    expect(c30.confidence_score).toBeGreaterThanOrEqual(90); // explicit → +10
    expect(c30.detection_reason).toContain('AT explicit withholding');
    expect(c30.detected_keys).toContain('source:at_sire');
    expect(c30.detected_keys).toContain('withholding:explicit');
    expect(c30.status).toBe('pending');

    // Validate FR/33 candidate
    const c33 = candidates.find((c) => c.document_reference.includes('FR/33'))!;
    expect(c33).toBeDefined();
    expect(c33.gross_amount).toBe(750);
    expect(c33.withholding_amount).toBe(172.5);
    expect(c33.withholding_rate).toBe(23); // 172.5/750 = 23%
    expect(c33.fiscal_year).toBe(2025);
  });

  it('Step 4: candidate → tax_withholdings (Modelo 10) has all required fields', () => {
    const rows = parsed.invoices.map((inv) =>
      buildSalesInvoiceRow(inv, CLIENT_ID, CLIENT_NIF, 'prestacao_servicos'),
    );

    const candidates: WithholdingCandidate[] = [];
    for (const row of rows) {
      const c = detectWithholdingCandidate(row, `fake-id-${row.document_number}`);
      if (c) candidates.push(c);
    }

    // Simulate promotion: candidate → tax_withholdings
    for (const c of candidates) {
      const taxWithholding = {
        beneficiary_nif: c.beneficiary_nif,
        beneficiary_name: null as string | null,
        client_id: c.client_id,
        fiscal_year: c.fiscal_year,
        income_category: c.income_category,
        gross_amount: c.gross_amount,
        withholding_amount: c.withholding_amount,
        withholding_rate: c.withholding_rate,
        payment_date: c.payment_date,
        document_reference: c.document_reference,
        location_code: 'C', // Continental
        source_sales_invoice_id: c.source_sales_invoice_id,
        status: 'validated',
      };

      // Validate all required Modelo 10 fields
      expect(taxWithholding.beneficiary_nif).toBeTruthy();
      expect(taxWithholding.beneficiary_nif).toHaveLength(9);
      expect(taxWithholding.client_id).toBeTruthy();
      expect(taxWithholding.fiscal_year).toBe(2025);
      expect(taxWithholding.income_category).toBe('B');
      expect(taxWithholding.gross_amount).toBeGreaterThan(0);
      expect(taxWithholding.withholding_amount).toBeGreaterThan(0);
      expect(taxWithholding.withholding_rate).toBeGreaterThan(0);
      expect(taxWithholding.payment_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(taxWithholding.location_code).toBe('C');

      // Verify fiscal consistency: withholding = gross * rate / 100
      const expectedWithholding = taxWithholding.gross_amount * taxWithholding.withholding_rate / 100;
      expect(Math.abs(taxWithholding.withholding_amount - expectedWithholding)).toBeLessThan(0.01);
    }
  });

  it('Step 5: explicit zero withholding does NOT create false positive candidates', () => {
    // FT/31 has explicit AT_SIRE_WITHHOLDING=0.00 to empresa 503998680
    // The detector must NOT create a candidate (would have been a heuristic false positive)
    const ft31 = parsed.invoices.find((i) => i.documentNumber.includes('FT/31'))!;
    const row = buildSalesInvoiceRow(ft31, CLIENT_ID, CLIENT_NIF, 'prestacao_servicos');

    // Verify customer IS an empresa (starts with 5)
    expect(row.customer_nif).toBe('503998680');
    expect(row.customer_nif![0]).toBe('5');

    // But explicit 0 withholding means no candidate
    const candidate = detectWithholdingCandidate(row, 'fake-id-ft31');
    expect(candidate).toBeNull();

    // Without the explicit zero (old heuristic flow), this WOULD have created a candidate
    const rowWithoutExplicit = { ...row, notes: 'Importado do SAF-T' };
    const heuristicCandidate = detectWithholdingCandidate(rowWithoutExplicit, 'fake-id-ft31');
    expect(heuristicCandidate).not.toBeNull();
    expect(heuristicCandidate!.withholding_amount).toBeGreaterThan(0);
    // This proves the explicit zero guard prevents false positives
  });

  it('Step 6: Portuguese comma decimals parse correctly in withholding amounts', () => {
    // The CSV has "172,50" (Portuguese format) for withholding
    const fr33 = parsed.invoices.find((i) => i.documentNumber.includes('FR/33'))!;
    expect(fr33.withholdingAmount).toBe(172.5);
    expect(fr33.withholdingAmount).not.toBe(17250); // Not treating comma as thousands separator
    expect(fr33.withholdingAmount).not.toBe(172); // Not truncating
  });
});
