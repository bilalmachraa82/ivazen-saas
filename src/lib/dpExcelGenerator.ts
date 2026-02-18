/**
 * DP Excel Generator — Aligned with official AT Declaração Periódica format
 * Sheets:
 * - Resumo DP (fields 1-96)
 * - Detalhe (monthly grids — purchases by supplier and sales by rate)
 * - Lista Facturas (compras)
 * - Lista Vendas
 */

import * as XLSX from 'xlsx';

// ── Interfaces ──────────────────────────────────────────────

export interface DPMonthlySupplier {
  nif: string;
  nome: string;
  ivaByMonth: Record<string, number>; // key = "2025-07", value = IVA amount
}

export interface DPMonthlyVendas {
  base6: number;
  iva6: number;
  base13: number;
  iva13: number;
  base23: number;
  iva23: number;
  isentas: number;
}

export interface DPExportData {
  periodo: string;
  cliente: string;
  meses: string[];
  mesesLabels: string[];

  // Vendas — IVA Liquidado (Campos 1-8)
  vendasBase6: number;
  vendasIva6: number;
  vendasBase23: number;
  vendasIva23: number;
  vendasBase13: number;
  vendasIva13: number;
  vendasIsentas: number;
  prestServIntracom: number;

  // Aquisições Intracomunitárias (Campos 10-11)
  aquisIntracomBase: number;
  aquisIntracomIva: number;

  // Compras — IVA Dedutível (Campos 20-24)
  imobilizado: number;
  existencias6: number;
  existencias23: number;
  existencias13: number;
  obs: number;

  // Regularizações (Campos 40-41)
  regFavorEstado: number;
  regSujeitoPassivo: number;

  // Crédito anterior (Campo 61)
  recuperarAnterior: number;

  // Detail data for Sheet 2
  obsDetalhe: DPMonthlySupplier[];
  existencias6Detalhe: DPMonthlySupplier[];
  existencias13Detalhe: DPMonthlySupplier[];
  existencias23Detalhe: DPMonthlySupplier[];
  imobilizadoDetalhe: DPMonthlySupplier[];
  vendasDetalheByMonth: Record<string, DPMonthlyVendas>;

  // Detail data for Sheet 3 (Lista Facturas)
  comprasDetalhe: InvoiceRecord[];

  // Detail data for Sheet 4 (Lista Vendas)
  vendasDetalhe: SalesInvoiceRecord[];
}

// ── Calculated fields ───────────────────────────────────────

function calculateTotals(data: DPExportData) {
  const campo90 = data.vendasBase6 + data.vendasBase13 + data.vendasBase23 + data.vendasIsentas + data.prestServIntracom;
  const campo91 = data.imobilizado + data.existencias6 + data.existencias13 + data.existencias23 + data.obs + data.regSujeitoPassivo + data.recuperarAnterior;
  const campo92 = data.vendasIva6 + data.vendasIva13 + data.vendasIva23 + data.aquisIntracomIva + data.regFavorEstado;
  const campo93 = Math.max(0, campo92 - campo91);
  const campo96 = Math.max(0, campo91 - campo92);
  return { campo90, campo91, campo92, campo93, campo96 };
}

// ── Sheet 1: Resumo DP ─────────────────────────────────────

function createResumoSheet(data: DPExportData): XLSX.WorkSheet {
  const t = calculateTotals(data);
  const fmt = (v: number) => Number(v.toFixed(2));

  const rows: (string | number | null)[][] = [
    [data.cliente],
    [data.periodo],
    [],
    ['VENDAS - IVA LIQUIDADO', '', '', '', '', ''],
    ['', 'Campo', 'Taxa', 'Base Tributável', 'Campo', 'IVA'],
    ['Base Tributável', 1, '6%', fmt(data.vendasBase6), 2, fmt(data.vendasIva6)],
    ['', 5, '13%', fmt(data.vendasBase13), 6, fmt(data.vendasIva13)],
    ['', 3, '23%', fmt(data.vendasBase23), 4, fmt(data.vendasIva23)],
    ['', 7, '0%', fmt(data.vendasIsentas), '', ''],
    ['', 8, '', fmt(data.prestServIntracom), '', ''],
    ['Aquis. Intracom.', 10, '', fmt(data.aquisIntracomBase), 11, fmt(data.aquisIntracomIva)],
    ['', '', 'Soma:', fmt(t.campo90), '', ''],
    [],
    ['COMPRAS - IVA DEDUTÍVEL', '', '', '', '', ''],
    ['', 'Campo', 'Descrição', '', '', 'IVA'],
    ['Imobilizado', 20, '', '', '', fmt(data.imobilizado)],
    ['Existências:', 21, '6%', '', '', fmt(data.existencias6)],
    ['', 23, '13%', '', '', fmt(data.existencias13)],
    ['', 22, '23%', '', '', fmt(data.existencias23)],
    ['OBS', 24, 'Soma:', '', '', fmt(data.obs)],
    [],
    ['Reg. Fv Suj Passivo', 40, '', fmt(data.regSujeitoPassivo), 41, fmt(data.regFavorEstado)],
    ['Recuperar Anterior', 61, '', fmt(data.recuperarAnterior), '', ''],
    [],
    [fmt(t.campo90), 90, '', 91, fmt(t.campo91), 92, fmt(t.campo92)],
    ['', '', '', 93, 'IVA a Pagar:', '', fmt(t.campo93)],
    ['', '', '', 96, 'IVA a Recuperar:', '', fmt(t.campo96)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 20 }, { wch: 8 }, { wch: 18 }, { wch: 15 }, { wch: 8 }, { wch: 15 }, { wch: 15 },
  ];
  return ws;
}

// ── Sheet 2: Detalhe Mensal (TRANSPOSED: months=rows, suppliers=columns) ──

function addTransposedSupplierSection(
  rows: (string | number | null)[][],
  title: string,
  suppliers: DPMonthlySupplier[],
  meses: string[],
  mesesLabels: string[],
) {
  if (suppliers.length === 0 && title !== 'OUTROS BENS E SERVIÇOS') return;

  // Ensure minimum 6 supplier columns
  const supplierNames = suppliers.map(s => s.nome);
  while (supplierNames.length < 6) supplierNames.push('');

  rows.push([title]);
  rows.push(['', ...supplierNames]);

  let sectionTotal = 0;
  meses.forEach((m, mi) => {
    const row: (string | number | null)[] = [mesesLabels[mi]];
    suppliers.forEach(s => {
      const val = Number((s.ivaByMonth[m] || 0).toFixed(2));
      sectionTotal += val;
      row.push(val);
    });
    // Pad empty columns
    for (let i = suppliers.length; i < 6; i++) row.push(0);
    rows.push(row);
  });

  // Total row
  const totalRow: (string | number | null)[] = [''];
  for (let i = 0; i < Math.max(suppliers.length, 6); i++) totalRow.push('');
  // Put total in last position
  totalRow.push(Number(sectionTotal.toFixed(2)));
  // Actually, just add a Soma row
  rows.pop(); // remove the padding total
  // Re-add: simpler approach — total after last month
  const somaRow: (string | number | null)[] = ['', '', '', '', '', '', 'Soma:', Number(sectionTotal.toFixed(2))];
  rows.push(somaRow);
  rows.push([]);
}

function createDetalheSheet(data: DPExportData): XLSX.WorkSheet {
  const rows: (string | number | null)[][] = [
    [data.cliente, '', '', '', data.periodo],
    [],
  ];

  const { meses, mesesLabels } = data;

  // OBS (Campo 24) — transposed
  addTransposedSection(rows, 'OUTROS BENS E SERVIÇOS', data.obsDetalhe, meses, mesesLabels);

  // Existências
  addTransposedSection(rows, 'EXISTÊNCIAS 6%', data.existencias6Detalhe, meses, mesesLabels);
  addTransposedSection(rows, 'EXISTÊNCIAS 13%', data.existencias13Detalhe, meses, mesesLabels);
  addTransposedSection(rows, 'EXISTÊNCIAS 23%', data.existencias23Detalhe, meses, mesesLabels);

  // Imobilizado
  addTransposedSection(rows, 'IMOBILIZADO', data.imobilizadoDetalhe, meses, mesesLabels);

  // Vendas section — transposed: months as rows, categories as columns
  rows.push(['VENDAS']);
  rows.push(['', 'Base 6%', 'IVA 6%', 'Base 13%', 'IVA 13%', 'Base 23%', 'IVA 23%', 'Isentas (Base)']);

  const vendasTotals = { base6: 0, iva6: 0, base13: 0, iva13: 0, base23: 0, iva23: 0, isentas: 0 };

  meses.forEach((m, mi) => {
    const v = data.vendasDetalheByMonth[m];
    const b6 = v ? Number(v.base6.toFixed(2)) : 0;
    const i6 = v ? Number(v.iva6.toFixed(2)) : 0;
    const b13 = v ? Number(v.base13.toFixed(2)) : 0;
    const i13 = v ? Number(v.iva13.toFixed(2)) : 0;
    const b23 = v ? Number(v.base23.toFixed(2)) : 0;
    const i23 = v ? Number(v.iva23.toFixed(2)) : 0;
    const isentas = v ? Number(v.isentas.toFixed(2)) : 0;

    vendasTotals.base6 += b6;
    vendasTotals.iva6 += i6;
    vendasTotals.base13 += b13;
    vendasTotals.iva13 += i13;
    vendasTotals.base23 += b23;
    vendasTotals.iva23 += i23;
    vendasTotals.isentas += isentas;

    rows.push([mesesLabels[mi], b6, i6, b13, i13, b23, i23, isentas]);
  });

  rows.push([
    '',
    Number(vendasTotals.base6.toFixed(2)),
    Number(vendasTotals.iva6.toFixed(2)),
    Number(vendasTotals.base13.toFixed(2)),
    Number(vendasTotals.iva13.toFixed(2)),
    Number(vendasTotals.base23.toFixed(2)),
    Number(vendasTotals.iva23.toFixed(2)),
    Number(vendasTotals.isentas.toFixed(2)),
  ]);

  rows.push([]);

  // Regularizacoes: values are entered as a period total (not monthly).
  // Put the period total in the last cell to avoid losing information in the "Detalhe" sheet.
  rows.push(['Regulariz favor estado', ...meses.map(() => 0), Number((data.regFavorEstado || 0).toFixed(2))]);
  rows.push(['Regulariz Sujeito Passivo', ...meses.map(() => 0), Number((data.regSujeitoPassivo || 0).toFixed(2))]);
  rows.push([]);

  // Aquisições intracomunitárias: show IVA (Campo 11) by month (when present) + total.
  const intracomIvaByMonth: Record<string, number> = {};
  data.comprasDetalhe.forEach(inv => {
    const dpField = inv.final_dp_field ?? inv.ai_dp_field ?? 24;
    if (dpField !== 10) return;
    const month = fiscalPeriodToMonth(inv.fiscal_period, inv.document_date);
    intracomIvaByMonth[month] = (intracomIvaByMonth[month] || 0) + (inv.total_vat || 0);
  });

  const intracomMonthValues = meses.map(m => intracomIvaByMonth[m] || 0);
  const intracomTotal = intracomMonthValues.reduce((acc, v) => acc + v, 0);
  rows.push(['Aquis Intracomun', ...intracomMonthValues.map(v => Number(v.toFixed(2))), Number(intracomTotal.toFixed(2))]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Dynamic column widths
  const maxCols = 8;
  ws['!cols'] = Array.from({ length: maxCols }, (_, i) => ({ wch: i === 0 ? 20 : 16 }));
  return ws;
}

/** Transposed section: months as rows, suppliers as columns, with Soma */
function addTransposedSection(
  rows: (string | number | null)[][],
  title: string,
  suppliers: DPMonthlySupplier[],
  meses: string[],
  mesesLabels: string[],
) {
  if (suppliers.length === 0 && title !== 'OUTROS BENS E SERVIÇOS') return;

  rows.push([title]);

  // Header: supplier names (pad to min 6)
  const names = suppliers.map(s => s.nome);
  while (names.length < 6) names.push('');
  rows.push(['', ...names]);

  let sectionTotal = 0;

  meses.forEach((m, mi) => {
    const row: (string | number | null)[] = [mesesLabels[mi]];
    for (let i = 0; i < Math.max(suppliers.length, 6); i++) {
      const s = suppliers[i];
      const val = s ? Number((s.ivaByMonth[m] || 0).toFixed(2)) : 0;
      sectionTotal += val;
      row.push(val);
    }
    rows.push(row);
  });

  // Soma row
  rows.push(['', '', '', '', 'Soma:', Number(sectionTotal.toFixed(2))]);
  rows.push([]);
}

// ── Public API ──────────────────────────────────────────────

const DP_FIELD_LABELS: Record<number, string> = {
  20: 'Imobilizado',
  21: 'Existências 6%',
  22: 'Existências 23%',
  23: 'Existências 13%',
  24: 'Outros Bens e Serviços',
};

function createListaFacturasSheet(data: DPExportData): XLSX.WorkSheet {
  const fmt = (v: number | null | undefined) => Number((v || 0).toFixed(2));

  const header = [
    'Data', 'NIF Fornecedor', 'Nome Fornecedor', 'Nº Documento',
    'Base 23%', 'IVA 23%', 'Base 13%', 'IVA 13%', 'Base 6%', 'IVA 6%',
    'Base Isenta', 'IVA Total', 'Total', 'Campo DP', 'Dedutib. %', 'IVA Dedutível', 'Excluída?', 'Motivo Exclusão', 'Classificação',
  ];

  const rows: (string | number)[][] = [header];

  let totBase23 = 0, totIva23 = 0, totBase13 = 0, totIva13 = 0;
  let totBase6 = 0, totIva6 = 0, totBaseIsenta = 0, totIvaTotal = 0;
  let totTotal = 0, totIvaDed = 0;

  data.comprasDetalhe.forEach(inv => {
    const isExcluded = !!(inv.exclusion_reason || '').trim();
    const dpField = inv.final_dp_field ?? inv.ai_dp_field ?? 24;
    const deductPct = (inv.final_deductibility ?? inv.ai_deductibility ?? 0);
    const ivaTotal = inv.total_vat || 0;
    const ivaDed = isExcluded ? 0 : ivaTotal * (deductPct / 100);

    const b23 = fmt(inv.base_standard);
    const v23 = fmt(inv.vat_standard);
    const b13 = fmt(inv.base_intermediate);
    const v13 = fmt(inv.vat_intermediate);
    const b6 = fmt(inv.base_reduced);
    const v6 = fmt(inv.vat_reduced);
    const bIsenta = fmt(inv.base_exempt);

    if (!isExcluded) {
      totBase23 += b23; totIva23 += v23;
      totBase13 += b13; totIva13 += v13;
      totBase6 += b6; totIva6 += v6;
      totBaseIsenta += bIsenta;
      totIvaTotal += fmt(ivaTotal);
      totTotal += fmt(inv.total_amount);
      totIvaDed += fmt(ivaDed);
    }

    rows.push([
      inv.document_date || '',
      inv.supplier_nif || '',
      inv.supplier_name || '',
      '', // document_number not in InvoiceRecord
      b23, v23, b13, v13, b6, v6, bIsenta,
      fmt(ivaTotal), fmt(inv.total_amount),
      DP_FIELD_LABELS[dpField] || `Campo ${dpField}`,
      deductPct,
      fmt(ivaDed),
      isExcluded ? 'Sim' : 'Não',
      inv.exclusion_reason || '',
      '', // classification not in InvoiceRecord
    ]);
  });

  // Totals row
  rows.push([
    'TOTAIS', '', '', '',
    fmt(totBase23), fmt(totIva23), fmt(totBase13), fmt(totIva13),
    fmt(totBase6), fmt(totIva6), fmt(totBaseIsenta),
    fmt(totIvaTotal), fmt(totTotal), '', '', fmt(totIvaDed), '', '', '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 14 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 18 },
  ];
  return ws;
}

function createListaVendasSheet(data: DPExportData): XLSX.WorkSheet {
  const fmt = (v: number | null | undefined) => Number((v || 0).toFixed(2));

  const header = [
    'Data', 'NIF Cliente', 'Nome Cliente', 'Nº Documento', 'Tipo',
    'Base 23%', 'IVA 23%', 'Base 13%', 'IVA 13%', 'Base 6%', 'IVA 6%',
    'Base Isenta', 'IVA Total', 'Total',
  ];

  const rows: (string | number)[][] = [header];

  let totBase23 = 0, totIva23 = 0, totBase13 = 0, totIva13 = 0;
  let totBase6 = 0, totIva6 = 0, totBaseIsenta = 0, totIvaTotal = 0;
  let totTotal = 0;

  data.vendasDetalhe.forEach(inv => {
    const b23 = fmt(inv.base_standard);
    const v23 = fmt(inv.vat_standard);
    const b13 = fmt(inv.base_intermediate);
    const v13 = fmt(inv.vat_intermediate);
    const b6 = fmt(inv.base_reduced);
    const v6 = fmt(inv.vat_reduced);
    const bIsenta = fmt(inv.base_exempt);
    const ivaTotal = fmt(inv.total_vat);
    const total = fmt(inv.total_amount);

    totBase23 += b23; totIva23 += v23;
    totBase13 += b13; totIva13 += v13;
    totBase6 += b6; totIva6 += v6;
    totBaseIsenta += bIsenta;
    totIvaTotal += ivaTotal;
    totTotal += total;

    rows.push([
      inv.document_date || '',
      inv.customer_nif || '',
      inv.customer_name || '',
      inv.document_number || '',
      inv.document_type || '',
      b23, v23, b13, v13, b6, v6,
      bIsenta, ivaTotal, total,
    ]);
  });

  rows.push([
    'TOTAIS', '', '', '', '',
    fmt(totBase23), fmt(totIva23), fmt(totBase13), fmt(totIva13),
    fmt(totBase6), fmt(totIva6), fmt(totBaseIsenta),
    fmt(totIvaTotal), fmt(totTotal),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 14 }, { wch: 25 }, { wch: 16 }, { wch: 8 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 10 }, { wch: 12 },
  ];
  return ws;
}

export function generateDPExcel(data: DPExportData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, createResumoSheet(data), 'Resumo DP');
  XLSX.utils.book_append_sheet(wb, createDetalheSheet(data), 'Detalhe');
  XLSX.utils.book_append_sheet(wb, createListaFacturasSheet(data), 'Lista Facturas');
  XLSX.utils.book_append_sheet(wb, createListaVendasSheet(data), 'Lista Vendas');
  return wb;
}

export function downloadDPExcel(data: DPExportData, filename?: string): void {
  const wb = generateDPExcel(data);
  const defaultFilename = `IVA_apur._${data.periodo.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, filename || defaultFilename);
}

// ── Builder from DB records ─────────────────────────────────

export interface InvoiceRecord {
  supplier_nif: string;
  supplier_name: string | null;
  document_date: string;
  fiscal_period: string | null;
  base_standard: number | null;
  base_intermediate: number | null;
  base_reduced: number | null;
  base_exempt: number | null;
  vat_standard: number | null;
  vat_intermediate: number | null;
  vat_reduced: number | null;
  total_vat: number | null;
  total_amount: number;
  final_dp_field: number | null;
  final_deductibility: number | null;
  ai_dp_field?: number | null;
  ai_deductibility?: number | null;
  exclusion_reason?: string | null;
}

export interface SalesInvoiceRecord {
  document_date: string;
  fiscal_period: string | null;
  document_number: string | null;
  document_type: string | null;
  customer_nif: string | null;
  customer_name: string | null;
  base_standard: number | null;
  base_intermediate: number | null;
  base_reduced: number | null;
  base_exempt: number | null;
  vat_standard: number | null;
  vat_intermediate: number | null;
  vat_reduced: number | null;
  total_vat: number | null;
  total_amount: number;
}

function fiscalPeriodToMonth(fp: string | null, docDate: string): string {
  if (fp && fp.length === 6) return `${fp.slice(0, 4)}-${fp.slice(4, 6)}`;
  if (fp && fp.match(/^\d{4}-\d{2}$/)) return fp;
  return docDate.slice(0, 7);
}

function getMonthLabel(month: string): string {
  const labels: Record<string, string> = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
    '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
  };
  return labels[month.slice(5, 7)] || month;
}

export function getQuarterMonths(year: number, quarter: number): string[] {
  const start = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map(i => {
    const m = String(start + i).padStart(2, '0');
    return `${year}-${m}`;
  });
}

export function getQuarterPeriod(year: number, quarter: number): string {
  const names = ['1º', '2º', '3º', '4º'];
  return `${names[quarter - 1]} trimestre ${year}`;
}

export function buildDPExportData(
  cliente: string,
  periodo: string,
  meses: string[],
  compras: InvoiceRecord[],
  vendas: SalesInvoiceRecord[],
  recuperarAnterior: number = 0,
  regFavorEstado: number = 0,
  regSujeitoPassivo: number = 0,
): DPExportData {
  // Store raw records for Lista Facturas sheet
  const mesesLabels = meses.map(getMonthLabel);

  const data: DPExportData = {
    cliente, periodo, meses, mesesLabels,
    vendasBase6: 0, vendasIva6: 0,
    vendasBase13: 0, vendasIva13: 0,
    vendasBase23: 0, vendasIva23: 0,
    vendasIsentas: 0, prestServIntracom: 0,
    aquisIntracomBase: 0, aquisIntracomIva: 0,
    imobilizado: 0,
    existencias6: 0, existencias13: 0, existencias23: 0,
    obs: 0,
    regFavorEstado, regSujeitoPassivo,
    recuperarAnterior,
    obsDetalhe: [], existencias6Detalhe: [], existencias13Detalhe: [],
    existencias23Detalhe: [], imobilizadoDetalhe: [],
    vendasDetalheByMonth: {},
    comprasDetalhe: compras,
    vendasDetalhe: vendas,
  };

  meses.forEach(m => {
    data.vendasDetalheByMonth[m] = {
      base6: 0, iva6: 0, base13: 0, iva13: 0, base23: 0, iva23: 0,
      isentas: 0,
    };
  });

  // ── Process purchases ──
  const supplierMap: Record<string, { nif: string; nome: string; byField: Record<number, Record<string, number>> }> = {};

  compras.forEach(inv => {
    if ((inv.exclusion_reason || '').trim()) return;

    const dpField = inv.final_dp_field ?? inv.ai_dp_field ?? 24;
    const deductPct = (inv.final_deductibility ?? inv.ai_deductibility ?? 0) / 100;
    const month = fiscalPeriodToMonth(inv.fiscal_period, inv.document_date);

    let ivaDeductible = 0;
    if (dpField === 10) {
      // Intra-community: reverse charge — IVA goes to Campo 11, base to Campo 10
      const baseTotal = (inv.base_standard || 0) + (inv.base_intermediate || 0) + (inv.base_reduced || 0) + (inv.base_exempt || 0);
      const ivaTotal = inv.total_vat || 0;
      data.aquisIntracomBase += baseTotal;
      data.aquisIntracomIva += ivaTotal;
      ivaDeductible = ivaTotal * deductPct;
      // Include deductible portion in Campo 24 (Outros bens e serviços) so net IVA (92-91) stays correct.
      // This keeps Resumo DP consistent with the Detalhe supplier grid which already groups field!=20/21/22/23 under OBS.
      data.obs += ivaDeductible;
    } else if (dpField === 20) {
      ivaDeductible = ((inv.vat_standard || 0) + (inv.vat_intermediate || 0) + (inv.vat_reduced || 0)) * deductPct;
      data.imobilizado += ivaDeductible;
    } else if (dpField === 21) {
      ivaDeductible = (inv.vat_reduced || 0) * deductPct;
      data.existencias6 += ivaDeductible;
    } else if (dpField === 22) {
      ivaDeductible = (inv.vat_standard || 0) * deductPct;
      data.existencias23 += ivaDeductible;
    } else if (dpField === 23) {
      ivaDeductible = (inv.vat_intermediate || 0) * deductPct;
      data.existencias13 += ivaDeductible;
    } else {
      ivaDeductible = (inv.total_vat || 0) * deductPct;
      data.obs += ivaDeductible;
    }

    const key = inv.supplier_nif;
    if (!supplierMap[key]) {
      supplierMap[key] = { nif: key, nome: inv.supplier_name || key, byField: {} };
    }
    if (!supplierMap[key].byField[dpField]) {
      supplierMap[key].byField[dpField] = {};
    }
    supplierMap[key].byField[dpField][month] = (supplierMap[key].byField[dpField][month] || 0) + ivaDeductible;
  });

  Object.values(supplierMap).forEach(s => {
    Object.entries(s.byField).forEach(([fieldStr, monthMap]) => {
      const field = Number(fieldStr);
      const entry: DPMonthlySupplier = { nif: s.nif, nome: s.nome, ivaByMonth: monthMap };
      if (field === 20) data.imobilizadoDetalhe.push(entry);
      else if (field === 21) data.existencias6Detalhe.push(entry);
      else if (field === 23) data.existencias13Detalhe.push(entry);
      else if (field === 22) data.existencias23Detalhe.push(entry);
      else data.obsDetalhe.push(entry);
    });
  });

  // ── Process sales ──
  vendas.forEach(inv => {
    const month = fiscalPeriodToMonth(inv.fiscal_period, inv.document_date);

    const b6 = inv.base_reduced || 0;
    const v6 = inv.vat_reduced || 0;
    const b13 = inv.base_intermediate || 0;
    const v13 = inv.vat_intermediate || 0;
    const b23 = inv.base_standard || 0;
    const v23 = inv.vat_standard || 0;
    const exempt = inv.base_exempt || 0;

    data.vendasBase6 += b6;
    data.vendasIva6 += v6;
    data.vendasBase13 += b13;
    data.vendasIva13 += v13;
    data.vendasBase23 += b23;
    data.vendasIva23 += v23;
    data.vendasIsentas += exempt;

    const md = data.vendasDetalheByMonth[month];
    if (md) {
      md.base6 += b6; md.iva6 += v6;
      md.base13 += b13; md.iva13 += v13;
      md.base23 += b23; md.iva23 += v23;
      md.isentas += exempt;
    }
  });

  return data;
}
