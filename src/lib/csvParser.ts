export interface ParsedInvoice {
  date: Date;
  documentNumber: string;
  customerNif: string;
  baseValue: number;
  vatValue: number;
  totalValue: number;
  documentType: string;
  quarter: string;
  description?: string;
  supplierName?: string;
}

export interface ParseResult {
  invoices: ParsedInvoice[];
  errors: string[];
  warnings: string[];
  fileType?: 'csv' | 'saft';
}

// Mapping of possible column headers to our standard fields
const COLUMN_MAPPINGS: Record<string, string[]> = {
  date: ['data', 'data emissão', 'data emissao', 'data de emissão', 'date', 'data factura', 'data fatura'],
  documentNumber: ['nº documento', 'numero', 'número', 'nº factura', 'nº fatura', 'document number', 'numero factura', 'numero fatura', 'nº', 'n.º'],
  customerNif: ['nif adquirente', 'nif cliente', 'nif', 'contribuinte', 'customer nif'],
  baseValue: ['valor base', 'base', 'valor tributável', 'base tributável', 'valor sem iva', 'base value', 'valor'],
  vatValue: ['iva', 'valor iva', 'imposto', 'vat', 'vat value'],
  totalValue: ['total', 'valor total', 'montante', 'total com iva', 'total value'],
  documentType: ['tipo', 'tipo documento', 'tipo de documento', 'document type'],
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findColumnIndex(headers: string[], fieldMappings: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  for (const mapping of fieldMappings) {
    const normalizedMapping = normalizeHeader(mapping);
    const index = normalizedHeaders.findIndex(h => h.includes(normalizedMapping) || normalizedMapping.includes(h));
    if (index !== -1) return index;
  }
  return -1;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  
  // Try common Portuguese date formats
  const formats = [
    /^(\d{2})[-/](\d{2})[-/](\d{4})$/, // DD-MM-YYYY or DD/MM/YYYY
    /^(\d{4})[-/](\d{2})[-/](\d{2})$/, // YYYY-MM-DD
    /^(\d{2})[-/](\d{2})[-/](\d{2})$/, // DD-MM-YY
  ];
  
  for (const format of formats) {
    const match = value.match(format);
    if (match) {
      if (format === formats[0]) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      } else if (format === formats[1]) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else {
        const year = parseInt(match[3]) + 2000;
        return new Date(year, parseInt(match[2]) - 1, parseInt(match[1]));
      }
    }
  }
  
  // Fallback to native parsing
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumber(value: string): number {
  if (!value) return 0;
  // Handle Portuguese number format (1.234,56 -> 1234.56)
  const normalized = value
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

export function getQuarterFromDate(date: Date): string {
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `${date.getFullYear()}-Q${quarter}`;
}

export function parseCSV(content: string): ParseResult {
  const result: ParseResult = {
    invoices: [],
    errors: [],
    warnings: [],
    fileType: 'csv',
  };

  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    result.errors.push('Ficheiro vazio ou sem dados');
    return result;
  }

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';
  
  // Parse headers
  const headers = firstLine.split(delimiter).map(h => h.replace(/"/g, '').trim());
  
  // Find column indices
  const columnMap = {
    date: findColumnIndex(headers, COLUMN_MAPPINGS.date),
    documentNumber: findColumnIndex(headers, COLUMN_MAPPINGS.documentNumber),
    customerNif: findColumnIndex(headers, COLUMN_MAPPINGS.customerNif),
    baseValue: findColumnIndex(headers, COLUMN_MAPPINGS.baseValue),
    vatValue: findColumnIndex(headers, COLUMN_MAPPINGS.vatValue),
    totalValue: findColumnIndex(headers, COLUMN_MAPPINGS.totalValue),
    documentType: findColumnIndex(headers, COLUMN_MAPPINGS.documentType),
  };

  // Check required columns
  if (columnMap.date === -1) {
    result.errors.push('Coluna de data não encontrada');
  }
  if (columnMap.baseValue === -1 && columnMap.totalValue === -1) {
    result.errors.push('Coluna de valor não encontrada');
  }

  if (result.errors.length > 0) {
    result.warnings.push(`Colunas detectadas: ${headers.join(', ')}`);
    return result;
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Handle quoted fields with delimiters inside
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    try {
      const dateValue = values[columnMap.date]?.replace(/"/g, '');
      const date = parseDate(dateValue);
      
      if (!date) {
        result.warnings.push(`Linha ${i + 1}: Data inválida "${dateValue}"`);
        continue;
      }

      const baseValue = columnMap.baseValue !== -1 
        ? parseNumber(values[columnMap.baseValue]?.replace(/"/g, '') || '')
        : 0;
      
      const vatValue = columnMap.vatValue !== -1 
        ? parseNumber(values[columnMap.vatValue]?.replace(/"/g, '') || '')
        : 0;
      
      const totalValue = columnMap.totalValue !== -1 
        ? parseNumber(values[columnMap.totalValue]?.replace(/"/g, '') || '')
        : baseValue + vatValue;

      // If we only have total, use it as base (for simplified invoices)
      const finalBaseValue = baseValue > 0 ? baseValue : totalValue;

      if (finalBaseValue <= 0) {
        result.warnings.push(`Linha ${i + 1}: Valor zero ou negativo`);
        continue;
      }

      const invoice: ParsedInvoice = {
        date,
        documentNumber: values[columnMap.documentNumber]?.replace(/"/g, '') || `DOC-${i}`,
        customerNif: values[columnMap.customerNif]?.replace(/"/g, '') || '',
        baseValue: finalBaseValue,
        vatValue,
        totalValue: totalValue > 0 ? totalValue : finalBaseValue,
        documentType: values[columnMap.documentType]?.replace(/"/g, '') || 'Fatura',
        quarter: getQuarterFromDate(date),
      };

      result.invoices.push(invoice);
    } catch (error) {
      result.warnings.push(`Linha ${i + 1}: Erro ao processar`);
    }
  }

  if (result.invoices.length === 0 && result.errors.length === 0) {
    result.errors.push('Nenhuma factura válida encontrada no ficheiro');
  }

  return result;
}

// SAFT-PT XML Parser
export function parseSAFT(content: string): ParseResult {
  const result: ParseResult = {
    invoices: [],
    errors: [],
    warnings: [],
    fileType: 'saft',
  };

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      result.errors.push('Ficheiro XML inválido ou corrompido');
      return result;
    }

    // Check if it's a valid SAFT file
    const auditFile = xmlDoc.querySelector('AuditFile');
    if (!auditFile) {
      result.errors.push('Ficheiro não é um SAFT-PT válido');
      return result;
    }

    // Get company info for context
    const companyName = xmlDoc.querySelector('Header > CompanyName')?.textContent || '';
    const taxRegistrationNumber = xmlDoc.querySelector('Header > TaxRegistrationNumber')?.textContent || '';
    
    if (companyName) {
      result.warnings.push(`Empresa: ${companyName} (NIF: ${taxRegistrationNumber})`);
    }

    // Find all invoices in SalesInvoices section
    const invoices = xmlDoc.querySelectorAll('SourceDocuments > SalesInvoices > Invoice');
    
    if (invoices.length === 0) {
      // Try alternative paths
      const altInvoices = xmlDoc.querySelectorAll('Invoice');
      if (altInvoices.length === 0) {
        result.errors.push('Nenhuma factura encontrada no ficheiro SAFT');
        return result;
      }
      invoices.forEach = altInvoices.forEach.bind(altInvoices);
    }

    invoices.forEach((invoice, index) => {
      try {
        // Get invoice date
        const invoiceDateStr = invoice.querySelector('InvoiceDate')?.textContent || 
                               invoice.querySelector('SystemEntryDate')?.textContent || '';
        
        const date = parseDate(invoiceDateStr);
        if (!date) {
          result.warnings.push(`Factura ${index + 1}: Data inválida`);
          return;
        }

        // Get document number
        const invoiceNo = invoice.querySelector('InvoiceNo')?.textContent || 
                          invoice.querySelector('DocumentNumber')?.textContent || 
                          `SAFT-${index + 1}`;

        // Get document type
        const invoiceType = invoice.querySelector('InvoiceType')?.textContent || 'FT';
        const documentType = mapSAFTDocumentType(invoiceType);

        // Skip credit notes and other non-revenue documents
        if (['NC', 'ND'].includes(invoiceType)) {
          result.warnings.push(`${invoiceNo}: Nota de crédito/débito ignorada`);
          return;
        }

        // Get customer NIF
        const customerID = invoice.querySelector('CustomerID')?.textContent || '';
        
        // Get totals
        const documentTotals = invoice.querySelector('DocumentTotals');
        const netTotal = parseFloat(documentTotals?.querySelector('NetTotal')?.textContent || '0');
        const taxPayable = parseFloat(documentTotals?.querySelector('TaxPayable')?.textContent || '0');
        const grossTotal = parseFloat(documentTotals?.querySelector('GrossTotal')?.textContent || '0');

        // Alternative: sum line totals
        let lineNetTotal = 0;
        let lineTaxTotal = 0;
        const lines = invoice.querySelectorAll('Line');
        lines.forEach(line => {
          const creditAmount = parseFloat(line.querySelector('CreditAmount')?.textContent || '0');
          const debitAmount = parseFloat(line.querySelector('DebitAmount')?.textContent || '0');
          lineNetTotal += creditAmount > 0 ? creditAmount : debitAmount;
          
          const tax = line.querySelector('Tax');
          if (tax) {
            const taxAmount = parseFloat(tax.querySelector('TaxAmount')?.textContent || '0');
            lineTaxTotal += taxAmount;
          }
        });

        const finalNetTotal = netTotal > 0 ? netTotal : lineNetTotal;
        const finalTaxTotal = taxPayable > 0 ? taxPayable : lineTaxTotal;
        const finalGrossTotal = grossTotal > 0 ? grossTotal : finalNetTotal + finalTaxTotal;

        if (finalNetTotal <= 0 && finalGrossTotal <= 0) {
          result.warnings.push(`${invoiceNo}: Valor zero ou negativo`);
          return;
        }

        const parsedInvoice: ParsedInvoice = {
          date,
          documentNumber: invoiceNo,
          customerNif: customerID,
          baseValue: finalNetTotal > 0 ? finalNetTotal : finalGrossTotal,
          vatValue: finalTaxTotal,
          totalValue: finalGrossTotal > 0 ? finalGrossTotal : finalNetTotal,
          documentType,
          quarter: getQuarterFromDate(date),
        };

        result.invoices.push(parsedInvoice);
      } catch (error) {
        result.warnings.push(`Factura ${index + 1}: Erro ao processar`);
      }
    });

    if (result.invoices.length === 0 && result.errors.length === 0) {
      result.errors.push('Nenhuma factura válida encontrada no ficheiro SAFT');
    }

  } catch (error) {
    result.errors.push('Erro ao processar ficheiro SAFT-PT');
  }

  return result;
}

function mapSAFTDocumentType(saftType: string): string {
  const typeMap: Record<string, string> = {
    'FT': 'Fatura',
    'FR': 'Fatura-Recibo',
    'FS': 'Fatura Simplificada',
    'VD': 'Venda a Dinheiro',
    'NC': 'Nota de Crédito',
    'ND': 'Nota de Débito',
    'RC': 'Recibo',
    'RG': 'Recibo Verde',
  };
  return typeMap[saftType] || saftType;
}

// Detect file type and parse accordingly
export function parseInvoiceFile(content: string, fileName: string): ParseResult {
  const extension = fileName.toLowerCase().split('.').pop();
  
  if (extension === 'xml') {
    // Check if it looks like SAFT
    if (content.includes('AuditFile') || content.includes('SAFT')) {
      return parseSAFT(content);
    }
    // Generic XML - try SAFT parser anyway
    return parseSAFT(content);
  }
  
  // Default to CSV
  return parseCSV(content);
}

export function aggregateByQuarter(invoices: ParsedInvoice[]): Map<string, number> {
  const totals = new Map<string, number>();
  
  for (const invoice of invoices) {
    const current = totals.get(invoice.quarter) || 0;
    totals.set(invoice.quarter, current + invoice.baseValue);
  }
  
  return totals;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

// CAE to Revenue Category Mapping
const CAE_CATEGORY_MAPPING: Record<string, string> = {
  // Prestação de Serviços (CAEs 62xxx, 69xxx, 70xxx, 71xxx, etc.)
  '62': 'prestacao_servicos',  // Consultoria informática
  '63': 'prestacao_servicos',  // Actividades de serviços de informação
  '69': 'prestacao_servicos',  // Jurídicas e contabilidade
  '70': 'prestacao_servicos',  // Consultoria gestão
  '71': 'prestacao_servicos',  // Arquitectura e engenharia
  '72': 'prestacao_servicos',  // Investigação científica
  '73': 'prestacao_servicos',  // Publicidade
  '74': 'prestacao_servicos',  // Outras actividades profissionais
  '75': 'prestacao_servicos',  // Actividades veterinárias
  '85': 'prestacao_servicos',  // Educação
  '86': 'prestacao_servicos',  // Saúde humana
  '87': 'prestacao_servicos',  // Apoio social com alojamento
  '88': 'prestacao_servicos',  // Apoio social sem alojamento
  '90': 'prestacao_servicos',  // Actividades artísticas
  '91': 'prestacao_servicos',  // Bibliotecas, museus
  '93': 'prestacao_servicos',  // Actividades desportivas
  '95': 'prestacao_servicos',  // Reparação de computadores
  '96': 'prestacao_servicos',  // Outras actividades de serviços pessoais
  
  // Vendas (CAEs 45xxx, 46xxx, 47xxx)
  '45': 'vendas',  // Comércio veículos
  '46': 'vendas',  // Comércio por grosso
  '47': 'vendas',  // Comércio a retalho
  
  // Hotelaria (CAEs 55xxx, 56xxx)
  '55': 'hotelaria',  // Alojamento
  '56': 'hotelaria',  // Restauração
  
  // Produção Agrícola (CAEs 01xxx, 02xxx, 03xxx)
  '01': 'producao_agricola',  // Agricultura
  '02': 'producao_agricola',  // Silvicultura
  '03': 'producao_agricola',  // Pesca
  
  // Produção Industrial (CAEs 10xxx-33xxx)
  '10': 'producao_industrial',  // Indústrias alimentares
  '11': 'producao_industrial',  // Indústria de bebidas
  '13': 'producao_industrial',  // Têxteis
  '14': 'producao_industrial',  // Vestuário
  '15': 'producao_industrial',  // Couro
  '16': 'producao_industrial',  // Madeira
  '17': 'producao_industrial',  // Papel
  '18': 'producao_industrial',  // Impressão
  '20': 'producao_industrial',  // Produtos químicos
  '22': 'producao_industrial',  // Borracha e plásticos
  '23': 'producao_industrial',  // Minerais não metálicos
  '24': 'producao_industrial',  // Metalurgia
  '25': 'producao_industrial',  // Produtos metálicos
  '26': 'producao_industrial',  // Produtos informáticos
  '27': 'producao_industrial',  // Equipamento eléctrico
  '28': 'producao_industrial',  // Máquinas
  '29': 'producao_industrial',  // Veículos automóveis
  '30': 'producao_industrial',  // Outro material transporte
  '31': 'producao_industrial',  // Mobiliário
  '32': 'producao_industrial',  // Outras indústrias
  '33': 'producao_industrial',  // Reparação e instalação
};

// Keywords for activity description matching
const ACTIVITY_KEYWORDS: Record<string, string[]> = {
  prestacao_servicos: [
    'consultoria', 'consultor', 'serviços', 'assessoria', 'formação',
    'design', 'desenvolvimento', 'programação', 'software', 'web',
    'marketing', 'publicidade', 'tradução', 'contabilidade', 'advocacia',
    'arquitectura', 'engenharia', 'médico', 'saúde', 'educação',
    'coaching', 'freelancer', 'digital', 'ti', 'informática',
  ],
  vendas: [
    'venda', 'vendas', 'comércio', 'comercial', 'loja', 'retalho',
    'grosso', 'distribuição', 'revenda', 'produtos', 'mercadorias',
  ],
  hotelaria: [
    'hotel', 'restaurante', 'café', 'bar', 'alojamento', 'turismo',
    'hospedagem', 'catering', 'alimentação', 'bebidas',
  ],
  producao_agricola: [
    'agrícola', 'agricultura', 'pecuária', 'pesca', 'florestal',
    'silvicultura', 'cultivo', 'produção animal', 'criação',
  ],
  producao_industrial: [
    'fabrico', 'fabricação', 'industrial', 'manufactura', 'produção',
    'transformação', 'montagem', 'construção',
  ],
};

export interface CategoryDetectionResult {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export function detectCategoryFromCAE(
  cae: string | null | undefined, 
  activityDescription?: string | null
): CategoryDetectionResult {
  // Default result
  const defaultResult: CategoryDetectionResult = {
    category: 'prestacao_servicos',
    confidence: 'low',
    reason: 'Categoria padrão - por favor confirme',
  };

  // Try CAE first (highest confidence)
  if (cae && cae.trim()) {
    const normalizedCAE = cae.trim().replace(/\D/g, '');
    
    // Try 2-digit prefix matching
    const prefix2 = normalizedCAE.substring(0, 2);
    if (CAE_CATEGORY_MAPPING[prefix2]) {
      return {
        category: CAE_CATEGORY_MAPPING[prefix2],
        confidence: 'high',
        reason: `Baseado no CAE ${cae}`,
      };
    }
  }

  // Try activity description (medium confidence)
  if (activityDescription && activityDescription.trim()) {
    const normalizedDesc = activityDescription.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    for (const [category, keywords] of Object.entries(ACTIVITY_KEYWORDS)) {
      for (const keyword of keywords) {
        const normalizedKeyword = keyword.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        
        if (normalizedDesc.includes(normalizedKeyword)) {
          return {
            category,
            confidence: 'medium',
            reason: `Baseado na descrição da actividade`,
          };
        }
      }
    }
  }

  return defaultResult;
}
