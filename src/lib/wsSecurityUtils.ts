/**
 * WS-Security Utilities for AT Webservice Authentication
 *
 * Implements the authentication mechanism required by Portuguese Tax Authority (AT)
 * as documented in "Comunicação dos elementos dos documentos de faturação" v3.0
 *
 * Algorithm (Manual AT p.15-17):
 * 1. Generate Ks = random AES 128-bit symmetric key (unique per request)
 * 2. Password = Base64(AES-128-ECB-PKCS5(plainPassword, Ks))
 * 3. Nonce = Base64(RSA-PKCS1v1.5(Ks, ChaveCifraPublicaAT))
 * 4. Created = Base64(AES-128-ECB-PKCS5(timestamp_ISO8601_UTC, Ks))
 *
 * Confirmed by community implementations:
 * - PHP:  OPENSSL_PKCS1_PADDING (eSkiSo/codigo_at)
 * - C#:   rsa.Encrypt(nounce, False) (donelodes gist)
 * - Java: Cipher.getInstance("RSA/ECB/PKCS1Padding")
 */

// AES-ECB with PKCS5 padding (required by AT, not PKCS7!)
// Note: ECB mode is required by AT specification, despite security concerns
function aesEcbEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  // PKCS5 padding (block size = 8 for compatibility, but AT uses 16)
  const blockSize = 16;
  const paddingLength = blockSize - (data.length % blockSize);
  const paddedData = new Uint8Array(data.length + paddingLength);
  paddedData.set(data);
  paddedData.fill(paddingLength, data.length);

  // Simple AES-ECB implementation for Deno/Edge Functions
  // In production, this would use node:crypto or a proper library
  // For now, we'll prepare the data and use Web Crypto API where possible
  
  return paddedData; // Placeholder - actual encryption done in Edge Function
}

// Generate random AES-128 key (16 bytes)
export function generateSymmetricKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// Convert string to Uint8Array
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to Base64
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Parse PEM-encoded certificate/key
export function parsePEM(pem: string): Uint8Array {
  // Remove headers and whitespace
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '');
  
  return base64ToBytes(base64);
}

// Generate ISO 8601 timestamp in UTC (format required by AT)
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export interface WSSecurityParams {
  username: string;         // Sub-user ID (e.g., "232945993/1")
  password: string;         // Sub-user password
  atPublicKeyPem: string;   // ChaveCifraPublicaAT2027.cer in PEM format
}

export interface WSSecurityHeader {
  username: string;
  encryptedPassword: string;  // Base64(AES-128-ECB(password, Ks))
  encryptedNonce: string;     // Base64(RSA-PKCS1v1.5(Ks, KpubAT))
  encryptedCreated: string;   // Base64(AES-128-ECB(timestamp, Ks))
  created: string;            // Plain timestamp (for debugging)
}

/**
 * Build SOAP envelope with WS-Security header
 */
export function buildSOAPEnvelope(
  operation: string,
  body: string,
  security: WSSecurityHeader
): string {
  // AT uses the 2002 WS-Security namespace (not 2004 OASIS)
  return `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
  <S:Header>
    <wss:Security xmlns:wss="http://schemas.xmlsoap.org/ws/2002/12/secext"
                  xmlns:at="http://at.pt/wsp/auth"
                  s:actor="http://at.pt/actor/SPA"
                  at:version="2">
      <wss:UsernameToken>
        <wss:Username>${security.username}</wss:Username>
        <wss:Password>${security.encryptedPassword}</wss:Password>
        <wss:Nonce>${security.encryptedNonce}</wss:Nonce>
        <wss:Created>${security.encryptedCreated}</wss:Created>
      </wss:UsernameToken>
    </wss:Security>
  </S:Header>
  <S:Body>
    ${body}
  </S:Body>
</S:Envelope>`;
}

/**
 * Build InvoicesRequest body for querying invoices
 */
export function buildInvoicesRequestBody(params: {
  taxRegistrationNumber: string;  // Emitter NIF (for sales) or null
  customerTaxID?: string;         // Acquirer NIF (for purchases)
  startDate: string;              // YYYY-MM-DD
  endDate: string;                // YYYY-MM-DD
  type?: 'E' | 'R';               // E=Emitter, R=Receiver
  page?: number;
  recordsPerPage?: number;
}): string {
  const lines: string[] = [];
  
  lines.push('<InvoicesRequest xmlns="http://at.gov.pt/fatshare/ws/">');
  
  if (params.taxRegistrationNumber) {
    lines.push(`  <TaxRegistrationNumber>${params.taxRegistrationNumber}</TaxRegistrationNumber>`);
  }
  if (params.customerTaxID) {
    lines.push(`  <CustomerTaxID>${params.customerTaxID}</CustomerTaxID>`);
  }
  
  lines.push(`  <StartDate>${params.startDate}</StartDate>`);
  lines.push(`  <EndDate>${params.endDate}</EndDate>`);
  
  if (params.type) {
    lines.push(`  <Type>${params.type}</Type>`);
  }
  if (params.page !== undefined) {
    lines.push(`  <Page>${params.page}</Page>`);
  }
  if (params.recordsPerPage !== undefined) {
    lines.push(`  <RecordsPerPage>${params.recordsPerPage}</RecordsPerPage>`);
  }
  
  lines.push('</InvoicesRequest>');
  
  return lines.join('\n');
}

/**
 * AT Webservice endpoints (from WSDLs)
 */
// AT convention (official AT manual v3.0, Oct 2025, pages 21-22): test = 7xx ports, production = 4xx ports
export const AT_ENDPOINTS = {
  // Invoice query (fatshareInvoices.wsdl)
  invoiceQuery: {
    test: 'https://servicos.portaldasfinancas.gov.pt:725/fatshare/ws/fatshareFaturas',
    production: 'https://servicos.portaldasfinancas.gov.pt:425/fatshare/ws/fatshareFaturas',
  },
  // Invoice submission (fatcorews.wsdl)
  invoiceSubmit: {
    test: 'https://servicos.portaldasfinancas.gov.pt:723/fatcorews/ws/',
    production: 'https://servicos.portaldasfinancas.gov.pt:423/fatcorews/ws/',
  },
} as const;

/**
 * SOAP Action headers for different operations
 */
export const SOAP_ACTIONS = {
  getInvoices: 'http://at.gov.pt/fatshare/ws/InvoicesRequest',
  submitInvoice: 'http://at.gov.pt/fatcorews/ws/RegisterInvoice',
} as const;

/**
 * Parse InvoicesResponse XML and extract invoice data
 */
export interface ATLineSummary {
  taxCode: 'NOR' | 'INT' | 'RED' | 'ISE';
  taxPercentage: number;
  taxCountryRegion: 'PT' | 'PT-AC' | 'PT-MA';
  amount: number;       // Base tributável
  taxAmount: number;    // Valor do IVA
}

export interface ATInvoice {
  supplierNif: string;
  supplierName: string;
  customerNif: string;
  customerName?: string;
  documentNumber: string;
  documentDate: string;
  documentType: string;
  atcud?: string;
  grossTotal: number;
  netTotal: number;
  taxPayable: number;
  lineSummary: ATLineSummary[];
}

export interface ATInvoicesResponse {
  success: boolean;
  totalRecords: number;
  currentPage: number;
  totalPages: number;
  invoices: ATInvoice[];
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Parse XML response from AT webservice
 * Note: In production, use a proper XML parser like fast-xml-parser
 */
export function parseInvoicesResponse(xmlText: string): ATInvoicesResponse {
  const result: ATInvoicesResponse = {
    success: false,
    totalRecords: 0,
    currentPage: 1,
    totalPages: 1,
    invoices: [],
  };
  
  // Check for SOAP Fault
  if (xmlText.includes('soap:Fault') || xmlText.includes('soapenv:Fault')) {
    const faultMatch = xmlText.match(/<faultstring>([^<]*)<\/faultstring>/);
    result.errorMessage = faultMatch ? faultMatch[1] : 'Unknown SOAP Fault';
    return result;
  }
  
  // Extract total records
  const totalMatch = xmlText.match(/<TotalRecords>(\d+)<\/TotalRecords>/);
  if (totalMatch) {
    result.totalRecords = parseInt(totalMatch[1]);
  }
  
  // Extract invoices
  const invoiceMatches = xmlText.matchAll(/<Invoice>([\s\S]*?)<\/Invoice>/g);
  
  for (const match of invoiceMatches) {
    const invoiceXml = match[1];
    
    const getValue = (tag: string): string => {
      const tagMatch = invoiceXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return tagMatch ? tagMatch[1] : '';
    };
    
    const getNumber = (tag: string): number => {
      return parseFloat(getValue(tag)) || 0;
    };
    
    // Parse LineSummary entries
    const lineSummary: ATLineSummary[] = [];
    const lineMatches = invoiceXml.matchAll(/<LineSummary>([\s\S]*?)<\/LineSummary>/g);
    
    for (const lineMatch of lineMatches) {
      const lineXml = lineMatch[1];
      const getLineValue = (tag: string): string => {
        const m = lineXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return m ? m[1] : '';
      };
      
      lineSummary.push({
        taxCode: (getLineValue('TaxCode') || 'NOR') as ATLineSummary['taxCode'],
        taxPercentage: parseFloat(getLineValue('TaxPercentage')) || 0,
        taxCountryRegion: (getLineValue('TaxCountryRegion') || 'PT') as ATLineSummary['taxCountryRegion'],
        amount: parseFloat(getLineValue('Amount')) || 0,
        taxAmount: parseFloat(getLineValue('TaxAmount')) || 0,
      });
    }
    
    result.invoices.push({
      supplierNif: getValue('SupplierNIF') || getValue('TaxRegistrationNumber'),
      supplierName: getValue('SupplierName') || getValue('CompanyName'),
      customerNif: getValue('CustomerNIF') || getValue('CustomerTaxID'),
      customerName: getValue('CustomerName'),
      documentNumber: getValue('DocumentNumber') || getValue('InvoiceNo'),
      documentDate: getValue('DocumentDate') || getValue('InvoiceDate'),
      documentType: getValue('DocumentType') || getValue('InvoiceType'),
      atcud: getValue('ATCUD'),
      grossTotal: getNumber('GrossTotal'),
      netTotal: getNumber('NetTotal'),
      taxPayable: getNumber('TaxPayable'),
      lineSummary,
    });
  }
  
  result.success = result.invoices.length > 0 || result.totalRecords === 0;
  result.totalPages = Math.ceil(result.totalRecords / 5000) || 1;
  
  return result;
}
