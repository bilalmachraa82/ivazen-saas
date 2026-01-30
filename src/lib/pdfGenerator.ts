import jsPDF from 'jspdf';
import { TaxWithholding } from '@/hooks/useWithholdings';
import { Profile } from '@/hooks/useProfile';

type IncomeCategory = 'A' | 'B' | 'E' | 'F' | 'G' | 'H' | 'R';

interface BeneficiaryData {
  nif: string;
  name: string | null;
  address: string | null;
  category: IncomeCategory;
  withholdings: TaxWithholding[];
  totals: {
    gross: number;
    exempt: number;
    dispensed: number;
    withholding: number;
    net: number;
  };
}

const getCategoryDescription = (category: IncomeCategory): string => {
  switch (category) {
    case 'A': return 'Rendimentos do Trabalho Dependente (Categoria A)';
    case 'B': return 'Rendimentos Empresariais e Profissionais (Categoria B)';
    case 'E': return 'Rendimentos de Capitais (Categoria E)';
    case 'F': return 'Rendimentos Prediais (Categoria F)';
    case 'G': return 'Incrementos Patrimoniais (Categoria G)';
    case 'H': return 'Pensões (Categoria H)';
    case 'R': return 'Rendimentos de Não Residentes (Categoria R)';
    default: return `Categoria ${category}`;
  }
};

const getLegalReference = (category: IncomeCategory): string => {
  switch (category) {
    case 'A': return 'Art.º 99.º do CIRS';
    case 'B': return 'Art.º 101.º, n.º 1 do CIRS';
    case 'E': return 'Art.º 71.º do CIRS';
    case 'F': return 'Art.º 101.º, n.º 1, al. e) do CIRS';
    case 'G': return 'Art.º 101.º, n.º 1 do CIRS';
    case 'H': return 'Art.º 99.º do CIRS';
    case 'R': return 'Art.º 71.º e 98.º do CIRS';
    default: return '';
  }
};

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-PT', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 2 
  });
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('pt-PT');
};

export function generateBeneficiaryPDF(
  beneficiary: BeneficiaryData,
  payer: Profile | null,
  fiscalYear: number
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  // Header - AT format style
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('MODELO 10', pageWidth / 2, y, { align: 'center' });
  y += 5;
  
  doc.setFontSize(14);
  doc.text('NOTA DOS RENDIMENTOS DEVIDOS', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.text('E DO IMPOSTO RETIDO', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`(Art.º 119.º, n.º 1, al. c) do CIRS - Portaria n.º 4/2024)`, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Fiscal Year
  doc.setFont('helvetica', 'bold');
  doc.text(`ANO FISCAL: ${fiscalYear}`, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Divider
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Section 1: Payer Entity
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTIDADE PAGADORA (Quadro 3)', margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const payerName = payer?.company_name || payer?.full_name || 'Não definido';
  const payerNif = payer?.nif || 'Não definido';
  const payerActivity = payer?.activity_description || '';
  const payerCae = payer?.cae || '';

  doc.text(`NIF: ${payerNif}`, margin, y);
  y += 5;
  doc.text(`Denominação/Nome: ${payerName}`, margin, y);
  y += 5;
  if (payerCae) {
    doc.text(`CAE: ${payerCae}`, margin, y);
    y += 5;
  }
  if (payerActivity) {
    doc.text(`Actividade: ${payerActivity}`, margin, y);
    y += 5;
  }
  y += 6;

  // Section 2: Beneficiary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('BENEFICIÁRIO DOS RENDIMENTOS (Quadro 4)', margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIF: ${beneficiary.nif}`, margin, y);
  y += 5;
  doc.text(`Nome: ${beneficiary.name || 'Não indicado'}`, margin, y);
  y += 5;
  if (beneficiary.address) {
    doc.text(`Morada: ${beneficiary.address}`, margin, y);
    y += 5;
  }
  y += 6;

  // Section 3: Income Category
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('NATUREZA DOS RENDIMENTOS (Quadro 5)', margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(getCategoryDescription(beneficiary.category), margin, y);
  y += 5;
  doc.text(`Enquadramento legal: ${getLegalReference(beneficiary.category)}`, margin, y);
  y += 10;

  // Section 4: Summary Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO DOS RENDIMENTOS E RETENÇÕES', margin, y);
  y += 8;

  // Table header
  const colWidths = [35, 35, 35, 35, 35];
  const tableHeaders = ['Bruto', 'Isento', 'Dispensado', 'Retido', 'Líquido'];
  
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, contentWidth, 8, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y - 4, contentWidth, 8, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  let xPos = margin + 2;
  tableHeaders.forEach((header, index) => {
    doc.text(header, xPos + colWidths[index] / 2, y, { align: 'center' });
    xPos += colWidths[index];
  });
  y += 6;

  // Table row with totals
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y - 4, contentWidth, 8, 'S');

  xPos = margin + 2;
  const values = [
    formatCurrency(beneficiary.totals.gross),
    formatCurrency(beneficiary.totals.exempt),
    formatCurrency(beneficiary.totals.dispensed),
    formatCurrency(beneficiary.totals.withholding),
    formatCurrency(beneficiary.totals.net),
  ];
  
  values.forEach((value, index) => {
    doc.text(value, xPos + colWidths[index] / 2, y, { align: 'center' });
    xPos += colWidths[index];
  });
  y += 12;

  // Section 5: Detailed list
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALHE DAS OPERAÇÕES', margin, y);
  y += 8;

  // Detail table header
  const detailCols = [25, 40, 35, 35, 35];
  const detailHeaders = ['Data', 'Referência', 'Bruto', 'Retido', 'Líquido'];

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, contentWidth, 7, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y - 4, contentWidth, 7, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  xPos = margin + 2;
  detailHeaders.forEach((header, index) => {
    doc.text(header, xPos + detailCols[index] / 2, y - 1, { align: 'center' });
    xPos += detailCols[index];
  });
  y += 5;

  // Detail rows
  doc.setFont('helvetica', 'normal');
  beneficiary.withholdings.forEach((w) => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }

    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y - 4, contentWidth, 7, 'S');

    xPos = margin + 2;
    const netAmount = Number(w.gross_amount) - Number(w.withholding_amount);
    const rowValues = [
      formatDate(w.payment_date),
      w.document_reference || '-',
      formatCurrency(Number(w.gross_amount)),
      formatCurrency(Number(w.withholding_amount)),
      formatCurrency(netAmount),
    ];

    rowValues.forEach((value, index) => {
      doc.text(value, xPos + detailCols[index] / 2, y - 1, { align: 'center' });
      xPos += detailCols[index];
    });
    y += 5;
  });

  y += 15;

  // Footer
  if (y > 250) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const today = new Date().toLocaleDateString('pt-PT');
  doc.text(`Documento gerado em: ${today}`, margin, y);
  y += 10;

  doc.setFont('helvetica', 'italic');
  doc.text('Este documento deve ser conservado pelo beneficiário para efeitos de', margin, y);
  y += 4;
  doc.text('declaração de IRS, nos termos do art.º 128.º do CIRS.', margin, y);
  y += 15;

  // Signature area
  doc.setFont('helvetica', 'normal');
  doc.text('A Entidade Pagadora', pageWidth - margin - 50, y);
  y += 15;
  doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);

  // Save PDF
  const fileName = `Nota_Rendimentos_${beneficiary.nif}_${fiscalYear}.pdf`;
  doc.save(fileName);
}

export function prepareBeneficiaryData(
  withholdings: TaxWithholding[],
  beneficiaryNif: string,
  category: IncomeCategory
): BeneficiaryData {
  const filtered = withholdings.filter(
    w => w.beneficiary_nif === beneficiaryNif && w.income_category === category
  );

  const first = filtered[0];
  const totals = filtered.reduce(
    (acc, w) => ({
      gross: acc.gross + Number(w.gross_amount),
      exempt: acc.exempt + Number(w.exempt_amount || 0),
      dispensed: acc.dispensed + Number(w.dispensed_amount || 0),
      withholding: acc.withholding + Number(w.withholding_amount),
      net: acc.net + (Number(w.gross_amount) - Number(w.withholding_amount)),
    }),
    { gross: 0, exempt: 0, dispensed: 0, withholding: 0, net: 0 }
  );

  return {
    nif: beneficiaryNif,
    name: first?.beneficiary_name || null,
    address: first?.beneficiary_address || null,
    category,
    withholdings: filtered,
    totals,
  };
}

/**
 * Get unique beneficiary-category combinations from withholdings
 */
export function getUniqueBeneficiaries(
  withholdings: TaxWithholding[]
): Array<{ nif: string; category: IncomeCategory; name: string | null }> {
  const uniqueMap = new Map<string, { nif: string; category: IncomeCategory; name: string | null }>();
  
  withholdings.forEach(w => {
    const key = `${w.beneficiary_nif}-${w.income_category}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        nif: w.beneficiary_nif,
        category: w.income_category,
        name: w.beneficiary_name,
      });
    }
  });

  return Array.from(uniqueMap.values());
}

/**
 * Generate PDFs for all unique beneficiaries
 */
export function generateAllBeneficiaryPDFs(
  withholdings: TaxWithholding[],
  payer: Profile | null,
  fiscalYear: number
): number {
  const uniqueBeneficiaries = getUniqueBeneficiaries(withholdings);
  
  uniqueBeneficiaries.forEach(({ nif, category }) => {
    const beneficiaryData = prepareBeneficiaryData(withholdings, nif, category);
    generateBeneficiaryPDF(beneficiaryData, payer, fiscalYear);
  });

  return uniqueBeneficiaries.length;
}
