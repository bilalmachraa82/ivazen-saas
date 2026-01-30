/**
 * Modelo 10 PDF Generator
 *
 * Generates PDF declarations for tax withholdings (Retenções na Fonte)
 * Follows the official AT (Autoridade Tributária) format
 *
 * Legal Reference: Portaria n.º 4/2024 de 4 de janeiro
 *
 * IMPORTANT: According to Portuguese law, each beneficiary (prestador) must receive
 * their own individual declaration. This module supports both:
 * - Single PDF with all beneficiaries (for internal use)
 * - Individual PDFs per beneficiary (legally required for distribution)
 */

import { jsPDF } from 'jspdf';
import { TaxWithholding, WithholdingSummary } from '@/hooks/useWithholdings';
import { Profile } from '@/hooks/useProfile';
import { getCountryName } from '@/lib/countries';
import { EmitterData, loadEmitterData, formatEmitterHeader } from '@/lib/emitterStorage';

// ============ TYPES ============

export interface Modelo10PDFData {
  withholdings: TaxWithholding[];
  summary: WithholdingSummary[];
  totals: {
    gross: number;
    withholding: number;
    count: number;
  };
  selectedYear: number;
  payerProfile: Profile | null;
  declarationType?: 'annual' | 'monthly' | 'import';
  clientName?: string | null;
  emitterData?: EmitterData | null;  // Optional: will load from storage if not provided
}

export interface PDFGenerationResult {
  success: boolean;
  filename?: string;
  error?: string;
}

export interface BeneficiaryPDFData {
  beneficiary_nif: string;
  beneficiary_name: string | null;
  beneficiary_address?: string | null;
  income_category: string;
  location_code: string;
  total_gross: number;
  total_exempt: number;
  total_dispensed: number;
  total_withholding: number;
  withholding_rate?: number;
  payment_count: number;
  payments: TaxWithholding[];
}

export interface IndividualPDFsResult {
  success: boolean;
  pdfs?: { filename: string; blob: Blob }[];
  error?: string;
}

// ============ CONSTANTS ============

const COLORS = {
  primary: [0, 51, 102] as [number, number, number],      // AT blue
  secondary: [51, 51, 51] as [number, number, number],    // Dark gray
  accent: [0, 102, 51] as [number, number, number],       // Green
  headerBg: [240, 240, 240] as [number, number, number],  // Light gray
  tableBg: [250, 250, 250] as [number, number, number],   // Very light gray
  border: [200, 200, 200] as [number, number, number],    // Border gray
};

const FONTS = {
  title: 16,
  subtitle: 12,
  header: 10,
  body: 9,
  small: 8,
};

const MARGINS = {
  top: 20,
  left: 15,
  right: 15,
  bottom: 20,
};

// ============ MAIN GENERATOR ============

/**
 * Generate Modelo 10 PDF declaration
 */
export function generateModelo10PDF(data: Modelo10PDFData): PDFGenerationResult {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGINS.left - MARGINS.right;

    // Load emitter data if not provided
    const emitterData = data.emitterData || loadEmitterData();

    let currentY = MARGINS.top;

    // ============ EMITTER HEADER ============
    if (emitterData.companyName) {
      currentY = drawEmitterHeader(doc, emitterData, currentY, pageWidth, contentWidth);
    }

    // ============ HEADER ============
    currentY = drawHeader(doc, data, currentY, pageWidth, contentWidth);

    // ============ PAYER INFO (QUADRO 1) ============
    currentY = drawPayerSection(doc, data, currentY, contentWidth);

    // ============ SUMMARY TABLE (QUADRO 5) ============
    currentY = drawSummaryTable(doc, data, currentY, contentWidth, pageHeight);

    // ============ TOTALS ============
    currentY = drawTotals(doc, data, currentY, contentWidth);

    // ============ FOOTER ============
    drawFooter(doc, data, pageWidth, pageHeight);

    // Generate filename and save
    const filename = `Modelo10_${data.selectedYear}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    return { success: true, filename };

  } catch (error: any) {
    console.error('PDF generation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate individual PDF declarations for each beneficiary
 * According to Portuguese law (Art. 119º CIRS), each beneficiary must receive
 * their own declaration showing the total amounts paid and withheld.
 */
export function generateIndividualBeneficiaryPDFs(data: Modelo10PDFData): IndividualPDFsResult {
  try {
    const pdfs: { filename: string; blob: Blob }[] = [];
    const emitterData = data.emitterData || loadEmitterData();

    // Group withholdings by beneficiary NIF
    const beneficiaryMap = new Map<string, BeneficiaryPDFData>();

    for (const withholding of data.withholdings) {
      const nif = withholding.beneficiary_nif;

      if (!beneficiaryMap.has(nif)) {
        beneficiaryMap.set(nif, {
          beneficiary_nif: nif,
          beneficiary_name: withholding.beneficiary_name,
          beneficiary_address: withholding.beneficiary_address,
          income_category: withholding.income_category,
          location_code: withholding.location_code,
          total_gross: 0,
          total_exempt: 0,
          total_dispensed: 0,
          total_withholding: 0,
          withholding_rate: withholding.withholding_rate || undefined,
          payment_count: 0,
          payments: [],
        });
      }

      const beneficiary = beneficiaryMap.get(nif)!;
      beneficiary.total_gross += Number(withholding.gross_amount) || 0;
      beneficiary.total_exempt += Number(withholding.exempt_amount) || 0;
      beneficiary.total_dispensed += Number(withholding.dispensed_amount) || 0;
      beneficiary.total_withholding += Number(withholding.withholding_amount) || 0;
      beneficiary.payment_count += 1;
      beneficiary.payments.push(withholding);
    }

    // Generate a PDF for each beneficiary
    for (const [nif, beneficiary] of beneficiaryMap) {
      const doc = createBeneficiaryPDF(beneficiary, data, emitterData);
      const blob = doc.output('blob');
      const safeNif = nif.replace(/[^0-9]/g, '');
      const safeName = (beneficiary.beneficiary_name || 'Beneficiario')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 20);
      const filename = `Modelo10_${data.selectedYear}_${safeNif}_${safeName}.pdf`;

      pdfs.push({ filename, blob });
    }

    return { success: true, pdfs };

  } catch (error: any) {
    console.error('Individual PDFs generation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a PDF for a single beneficiary
 */
function createBeneficiaryPDF(
  beneficiary: BeneficiaryPDFData,
  data: Modelo10PDFData,
  emitterData: EmitterData
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGINS.left - MARGINS.right;

  let currentY = MARGINS.top;

  // NOTE: Removed emitter header from localStorage - now using payerProfile data directly
  // The payer info is shown in the ENTIDADE PAGADORA section below

  // ============ DOCUMENT TITLE ============
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGINS.left, currentY, contentWidth, 14, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(FONTS.title);
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARAÇÃO DE RENDIMENTOS E RETENÇÕES', pageWidth / 2, currentY + 6, { align: 'center' });

  doc.setFontSize(FONTS.subtitle);
  doc.text('(Alínea b) do Nº1 do Art. 119º do CIRS e Art. 128º do CIRC)', pageWidth / 2, currentY + 11, { align: 'center' });

  currentY += 18;

  // ============ PAYER SECTION (Entidade Pagadora/Adquirente) ============
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(MARGINS.left, currentY, contentWidth, 8, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, currentY, contentWidth, 8, 'S');

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTIDADE PAGADORA / ADQUIRENTE', MARGINS.left + 3, currentY + 5.5);

  currentY += 12;

  // Payer info box
  const payerBoxHeight = 22;
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, currentY, contentWidth, payerBoxHeight, 'S');

  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.body);

  const profile = data.payerProfile;
  // IMPORTANT: Use client data from profile, NOT emitterData (localStorage)
  // emitterData contains accountant's company, not the client's
  const payerNif = profile?.nif || 'Não configurado';
  const payerName = data.clientName || profile?.company_name || profile?.full_name || 'Não configurado';
  // For address, we don't have client address in profile - leave empty or use placeholder
  const payerAddress = '-';

  doc.setFont('helvetica', 'bold');
  doc.text('NIF da Empresa:', MARGINS.left + 3, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(payerNif, MARGINS.left + 35, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Nome/Firma:', MARGINS.left + 3, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(payerName.substring(0, 60), MARGINS.left + 28, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Morada:', MARGINS.left + 3, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(payerAddress.substring(0, 70), MARGINS.left + 20, currentY + 18);

  currentY += payerBoxHeight + 8;

  // ============ BENEFICIARY SECTION (Prestador) ============
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(MARGINS.left, currentY, contentWidth, 8, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, currentY, contentWidth, 8, 'S');

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');
  doc.text('BENEFICIÁRIO / PRESTADOR', MARGINS.left + 3, currentY + 5.5);

  currentY += 12;

  // Beneficiary info box
  const beneficiaryBoxHeight = 22;
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, currentY, contentWidth, beneficiaryBoxHeight, 'S');

  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.body);

  doc.setFont('helvetica', 'bold');
  doc.text('NIF:', MARGINS.left + 3, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(beneficiary.beneficiary_nif, MARGINS.left + 15, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Nome:', MARGINS.left + 3, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text((beneficiary.beneficiary_name || '-').substring(0, 60), MARGINS.left + 18, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Morada:', MARGINS.left + 3, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text((beneficiary.beneficiary_address || '-').substring(0, 70), MARGINS.left + 20, currentY + 18);

  currentY += beneficiaryBoxHeight + 8;

  // ============ INCOME DETAILS ============
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(MARGINS.left, currentY, contentWidth, 8, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, currentY, contentWidth, 8, 'S');

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');
  doc.text('RENDIMENTOS E RETENÇÕES', MARGINS.left + 3, currentY + 5.5);

  // Year and category on right
  doc.text(`Ano: ${data.selectedYear}`, MARGINS.left + contentWidth - 50, currentY + 5.5);

  currentY += 12;

  // Income details box
  const incomeBoxHeight = 50;
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, currentY, contentWidth, incomeBoxHeight, 'S');

  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.body);

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('Categoria de Rendimentos:', MARGINS.left + 3, currentY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${beneficiary.income_category}: ${getCategoryDescription(beneficiary.income_category)}`, MARGINS.left + 50, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('Ano dos Rendimentos:', MARGINS.left + 3, currentY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(data.selectedYear.toString(), MARGINS.left + 45, currentY + 16);

  // Divider line
  doc.setDrawColor(...COLORS.border);
  doc.line(MARGINS.left + 3, currentY + 22, MARGINS.left + contentWidth - 3, currentY + 22);

  // Income values section
  doc.setFont('helvetica', 'bold');
  doc.text('Rendimentos Devidos', MARGINS.left + 3, currentY + 28);

  doc.setFont('helvetica', 'normal');
  doc.text('Total de Rendimentos sujeitos a IRS:', MARGINS.left + 5, currentY + 35);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(beneficiary.total_gross), MARGINS.left + contentWidth - 5, currentY + 35, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Rendimentos sujeitos a retenção na fonte:', MARGINS.left + 5, currentY + 41);
  const taxableAmount = beneficiary.total_gross - beneficiary.total_exempt - beneficiary.total_dispensed;
  doc.text(formatCurrency(taxableAmount), MARGINS.left + contentWidth - 5, currentY + 41, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Rendimentos sujeitos a IRS mas dispensados de retenção:', MARGINS.left + 5, currentY + 47);
  doc.text(formatCurrency(beneficiary.total_dispensed), MARGINS.left + contentWidth - 5, currentY + 47, { align: 'right' });

  currentY += incomeBoxHeight + 4;

  // ============ WITHHOLDING TOTAL BOX ============
  const withholdingBoxHeight = 16;
  doc.setFillColor(...COLORS.accent);
  doc.rect(MARGINS.left, currentY, contentWidth, withholdingBoxHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');

  doc.text('Imposto Retido', MARGINS.left + 5, currentY + 6);
  doc.text('Total de Imposto Retido:', MARGINS.left + 5, currentY + 12);

  doc.setFontSize(FONTS.subtitle);
  doc.text(formatCurrency(beneficiary.total_withholding), MARGINS.left + contentWidth - 5, currentY + 10, { align: 'right' });

  currentY += withholdingBoxHeight + 8;

  // NOTE: Payment details table removed per user request
  // The individual declaration only needs totals, not line-by-line details

  // ============ DATE AND SIGNATURE ============
  currentY = Math.max(currentY, pageHeight - 60);

  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'normal');

  // Date line
  const generationDate = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
  // Use generic location since we don't have client's city
  doc.text(`Portugal, ${generationDate}`, MARGINS.left + 3, currentY);

  currentY += 10;

  // Signature section
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, currentY, contentWidth, 25, 'S');

  doc.text('A Entidade Pagadora:', MARGINS.left + 5, currentY + 6);

  // Signature line
  doc.line(MARGINS.left + 5, currentY + 18, MARGINS.left + 80, currentY + 18);
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'italic');
  doc.text('(Assinatura, Carimbo)', MARGINS.left + 25, currentY + 22);

  // ============ FOOTER ============
  drawFooter(doc, data, pageWidth, pageHeight);

  return doc;
}

// ============ SECTION DRAWING FUNCTIONS ============

/**
 * Draw document header
 */
function drawHeader(
  doc: jsPDF,
  data: Modelo10PDFData,
  startY: number,
  pageWidth: number,
  contentWidth: number
): number {
  let y = startY;

  // Logo/Header area
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGINS.left, y, contentWidth, 12, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(FONTS.title);
  doc.setFont('helvetica', 'bold');
  doc.text('MODELO 10', pageWidth / 2, y + 8, { align: 'center' });

  y += 16;

  // Subtitle
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.subtitle);
  doc.setFont('helvetica', 'normal');
  doc.text('DECLARAÇÃO DE RENDIMENTOS E RETENÇÕES NA FONTE', pageWidth / 2, y, { align: 'center' });

  y += 6;

  // Year
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');
  doc.text(`Ano Fiscal: ${data.selectedYear}`, pageWidth / 2, y, { align: 'center' });

  y += 8;

  // Legal reference
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Ref. Legal: Art. 119º CIRS / Art. 128º CIRC / Portaria n.º 4/2024', pageWidth / 2, y, { align: 'center' });

  y += 10;

  return y;
}

/**
 * Draw payer information section (Quadro 1)
 */
function drawPayerSection(
  doc: jsPDF,
  data: Modelo10PDFData,
  startY: number,
  contentWidth: number
): number {
  let y = startY;

  // Section header
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(MARGINS.left, y, contentWidth, 8, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, y, contentWidth, 8, 'S');

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');
  doc.text('QUADRO 1 - ENTIDADE PAGADORA', MARGINS.left + 3, y + 5.5);

  y += 12;

  // Content box
  const boxHeight = 28;
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, y, contentWidth, boxHeight, 'S');

  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'normal');

  const profile = data.payerProfile;
  const clientDisplay = data.clientName || profile?.company_name || profile?.full_name || 'Não configurado';
  const nifDisplay = profile?.nif || 'Não configurado';
  const caeDisplay = profile?.cae || '-';
  const activityDisplay = profile?.activity_description || '-';

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('NIF:', MARGINS.left + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(nifDisplay, MARGINS.left + 20, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Nome/Firma:', MARGINS.left + 3, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(clientDisplay.substring(0, 50), MARGINS.left + 28, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('CAE:', MARGINS.left + 3, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(caeDisplay, MARGINS.left + 15, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Actividade:', MARGINS.left + 3, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(activityDisplay.substring(0, 60), MARGINS.left + 28, y + 24);

  // Right column
  const rightCol = MARGINS.left + contentWidth / 2 + 10;
  const generationDate = new Date().toLocaleDateString('pt-PT');

  doc.setFont('helvetica', 'bold');
  doc.text('Data Geração:', rightCol, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(generationDate, rightCol + 28, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Registos:', rightCol, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.totals.count.toString(), rightCol + 28, y + 12);

  y += boxHeight + 8;

  return y;
}

/**
 * Draw summary table (Quadro 5)
 */
function drawSummaryTable(
  doc: jsPDF,
  data: Modelo10PDFData,
  startY: number,
  contentWidth: number,
  pageHeight: number
): number {
  let y = startY;

  // Section header
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(MARGINS.left, y, contentWidth, 8, 'F');
  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, y, contentWidth, 8, 'S');

  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');
  doc.text('QUADRO 5 - RESUMO POR BENEFICIÁRIO', MARGINS.left + 3, y + 5.5);

  y += 12;

  // Table header
  const colWidths = {
    nif: 25,
    nome: 55,
    cat: 12,
    loc: 12,
    bruto: 28,
    retencao: 28,
    docs: 18,
  };

  const headerHeight = 8;
  doc.setFillColor(...COLORS.primary);
  doc.rect(MARGINS.left, y, contentWidth, headerHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'bold');

  let colX = MARGINS.left + 2;
  doc.text('NIF', colX, y + 5.5);
  colX += colWidths.nif;
  doc.text('Nome Beneficiário', colX, y + 5.5);
  colX += colWidths.nome;
  doc.text('Cat.', colX, y + 5.5);
  colX += colWidths.cat;
  doc.text('Local', colX, y + 5.5);
  colX += colWidths.loc;
  doc.text('Rend. Bruto (€)', colX, y + 5.5);
  colX += colWidths.bruto;
  doc.text('Retenção (€)', colX, y + 5.5);
  colX += colWidths.retencao;
  doc.text('Docs', colX, y + 5.5);

  y += headerHeight;

  // Table rows
  const rowHeight = 7;
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'normal');

  for (let i = 0; i < data.summary.length; i++) {
    // Check for page break
    if (y + rowHeight > pageHeight - MARGINS.bottom - 30) {
      doc.addPage();
      y = MARGINS.top;

      // Redraw table header on new page
      doc.setFillColor(...COLORS.primary);
      doc.rect(MARGINS.left, y, contentWidth, headerHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(FONTS.small);
      doc.setFont('helvetica', 'bold');

      colX = MARGINS.left + 2;
      doc.text('NIF', colX, y + 5.5);
      colX += colWidths.nif;
      doc.text('Nome Beneficiário', colX, y + 5.5);
      colX += colWidths.nome;
      doc.text('Cat.', colX, y + 5.5);
      colX += colWidths.cat;
      doc.text('Local', colX, y + 5.5);
      colX += colWidths.loc;
      doc.text('Rend. Bruto (€)', colX, y + 5.5);
      colX += colWidths.bruto;
      doc.text('Retenção (€)', colX, y + 5.5);
      colX += colWidths.retencao;
      doc.text('Docs', colX, y + 5.5);

      y += headerHeight;
      doc.setTextColor(...COLORS.secondary);
      doc.setFont('helvetica', 'normal');
    }

    const item = data.summary[i];

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.tableBg);
      doc.rect(MARGINS.left, y, contentWidth, rowHeight, 'F');
    }

    // Draw row border
    doc.setDrawColor(...COLORS.border);
    doc.rect(MARGINS.left, y, contentWidth, rowHeight, 'S');

    // Draw row content
    colX = MARGINS.left + 2;
    doc.text(item.beneficiary_nif, colX, y + 5);
    colX += colWidths.nif;
    doc.text((item.beneficiary_name || '').substring(0, 30), colX, y + 5);
    colX += colWidths.nome;
    doc.text(item.income_category, colX, y + 5);
    colX += colWidths.cat;
    doc.text(getLocationLabel(item.location_code), colX, y + 5);
    colX += colWidths.loc;
    doc.text(formatNumber(Number(item.total_gross)), colX, y + 5);
    colX += colWidths.bruto;
    doc.text(formatNumber(Number(item.total_withholding)), colX, y + 5);
    colX += colWidths.retencao;
    doc.text(item.count.toString(), colX, y + 5);

    y += rowHeight;
  }

  // Empty state
  if (data.summary.length === 0) {
    doc.setFillColor(...COLORS.tableBg);
    doc.rect(MARGINS.left, y, contentWidth, 10, 'F');
    doc.setDrawColor(...COLORS.border);
    doc.rect(MARGINS.left, y, contentWidth, 10, 'S');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(FONTS.body);
    doc.text('Sem registos para o período seleccionado', MARGINS.left + contentWidth / 2, y + 6.5, { align: 'center' });
    y += 10;
  }

  y += 6;

  return y;
}

/**
 * Draw totals section
 */
function drawTotals(
  doc: jsPDF,
  data: Modelo10PDFData,
  startY: number,
  contentWidth: number
): number {
  let y = startY;

  // Totals box
  const boxHeight = 20;
  doc.setFillColor(...COLORS.accent);
  doc.rect(MARGINS.left, y, contentWidth, boxHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');

  // Title
  doc.text('TOTAIS', MARGINS.left + 5, y + 7);

  // Total gross
  const totalGrossLabel = 'Rendimento Bruto Total:';
  const totalGrossValue = formatCurrency(data.totals.gross);
  doc.text(totalGrossLabel, MARGINS.left + 50, y + 7);
  doc.text(totalGrossValue, MARGINS.left + 95, y + 7);

  // Total withholding
  const totalWithholdingLabel = 'Total Retenções:';
  const totalWithholdingValue = formatCurrency(data.totals.withholding);
  doc.text(totalWithholdingLabel, MARGINS.left + 115, y + 7);
  doc.text(totalWithholdingValue, MARGINS.left + 150, y + 7);

  // Net amount
  const netAmount = data.totals.gross - data.totals.withholding;
  doc.setFontSize(FONTS.body);
  doc.text(`Rendimento Líquido: ${formatCurrency(netAmount)}`, MARGINS.left + 50, y + 14);
  doc.text(`Total de Documentos: ${data.totals.count}`, MARGINS.left + 115, y + 14);

  y += boxHeight + 8;

  // Signature section
  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.body);
  doc.setFont('helvetica', 'normal');

  doc.setDrawColor(...COLORS.border);
  doc.rect(MARGINS.left, y, contentWidth, 25, 'S');

  doc.text('Data: ____/____/________', MARGINS.left + 5, y + 8);
  doc.text('O Responsável:', MARGINS.left + contentWidth / 2, y + 8);

  // Signature line
  doc.line(MARGINS.left + contentWidth / 2, y + 20, MARGINS.left + contentWidth - 10, y + 20);

  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'italic');
  doc.text('(assinatura e carimbo)', MARGINS.left + contentWidth * 0.7, y + 23);

  y += 30;

  return y;
}

/**
 * Draw emitter company header
 */
function drawEmitterHeader(
  doc: jsPDF,
  emitterData: EmitterData,
  startY: number,
  pageWidth: number,
  contentWidth: number
): number {
  let y = startY;

  // Emitter box
  doc.setDrawColor(...COLORS.border);
  doc.setFillColor(255, 255, 255);
  doc.rect(MARGINS.left, y, contentWidth, 22, 'S');

  doc.setTextColor(...COLORS.secondary);
  doc.setFontSize(FONTS.header);
  doc.setFont('helvetica', 'bold');

  // Company name
  doc.text(emitterData.companyName, MARGINS.left + 5, y + 6);

  // Address line
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'normal');
  const addressParts = [
    emitterData.companyAddress,
    emitterData.companyPostalCode && emitterData.companyCity
      ? `${emitterData.companyPostalCode} ${emitterData.companyCity}`
      : emitterData.companyCity,
  ].filter(Boolean);
  if (addressParts.length > 0) {
    doc.text(addressParts.join(' | '), MARGINS.left + 5, y + 11);
  }

  // NIF and contact
  const infoParts = [
    emitterData.companyNIF ? `NIF: ${emitterData.companyNIF}` : '',
    emitterData.email,
    emitterData.phone,
  ].filter(Boolean);
  if (infoParts.length > 0) {
    doc.text(infoParts.join(' | '), MARGINS.left + 5, y + 16);
  }

  // Responsible person (right side)
  if (emitterData.responsibleName) {
    doc.setFont('helvetica', 'italic');
    const responsibleText = emitterData.responsibleRole
      ? `${emitterData.responsibleName} - ${emitterData.responsibleRole}`
      : emitterData.responsibleName;
    doc.text(responsibleText, MARGINS.left + contentWidth - 5, y + 6, { align: 'right' });
  }

  y += 26;

  return y;
}

/**
 * Draw document footer
 */
function drawFooter(
  doc: jsPDF,
  data: Modelo10PDFData,
  pageWidth: number,
  pageHeight: number
): void {
  const footerY = pageHeight - MARGINS.bottom + 5;

  doc.setFillColor(...COLORS.headerBg);
  doc.rect(MARGINS.left, footerY, pageWidth - MARGINS.left - MARGINS.right, 10, 'F');

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(FONTS.small);
  doc.setFont('helvetica', 'normal');

  // Left: Generation info
  doc.text(
    `Gerado por IVAzen em ${new Date().toLocaleString('pt-PT')}`,
    MARGINS.left + 3,
    footerY + 6
  );

  // Right: Page number
  const pageNum = doc.getCurrentPageInfo().pageNumber;
  doc.text(
    `Página ${pageNum}`,
    pageWidth - MARGINS.right - 15,
    footerY + 6
  );

  // Center: Session reference (anonymized)
  doc.setFontSize(6);
  doc.text(
    'Documento gerado automaticamente - verificar dados antes de submissão',
    pageWidth / 2,
    footerY + 6,
    { align: 'center' }
  );
}

// ============ HELPER FUNCTIONS ============

/**
 * Format number with Portuguese locale
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format currency with euro symbol
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

/**
 * Get location label from code
 */
function getLocationLabel(code: string): string {
  switch (code) {
    case 'C': return 'Cont.';
    case 'RA': return 'Açores';
    case 'RM': return 'Madeira';
    default: return code;
  }
}

/**
 * Get category description
 */
export function getCategoryDescription(category: string): string {
  switch (category) {
    case 'A': return 'Trabalho Dependente';
    case 'B': return 'Empresarial/Profissional';
    case 'E': return 'Rendimentos de Capitais';
    case 'F': return 'Rendimentos Prediais';
    case 'G': return 'Incrementos Patrimoniais';
    case 'H': return 'Pensões';
    case 'R': return 'Retenções IRC';
    default: return 'Outro';
  }
}

/**
 * Get legal reference for category
 */
export function getLegalReference(category: string): string {
  switch (category) {
    case 'A': return 'Art. 99º CIRS';
    case 'B': return 'Art. 101º CIRS';
    case 'E': return 'Art. 71º CIRS';
    case 'F': return 'Art. 101º CIRS';
    case 'G': return 'Art. 72º CIRS';
    case 'H': return 'Art. 99º-A CIRS';
    case 'R': return 'Art. 94º CIRC';
    default: return 'Art. 119º CIRS';
  }
}
