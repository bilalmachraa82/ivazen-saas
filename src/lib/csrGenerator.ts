/**
 * CSR Generator for AT Certificate Request
 * Uses node-forge to generate RSA key pair and CSR in the browser
 * 
 * REQUISITOS AT (Portaria 4/2024 + erros AT Fev 2025):
 * - RSA 4096 bits (não 2048!)
 * - CN = NIF (não nome da app)
 * - O = Nome/Firma
 * - C = PT
 * - ST = Distrito (obrigatório)
 * - L = Localidade/Cidade (obrigatório)
 * - E = Email de contacto (obrigatório)
 */

import forge from 'node-forge';

export interface CSRData {
  nif: string;                    // CN = NIF (obrigatório)
  organizationName: string;       // O = Nome empresa/pessoa
  countryCode: string;            // C = PT
  stateOrProvince: string;        // ST = Distrito (obrigatório)
  locality: string;               // L = Cidade (obrigatório)
  email: string;                  // E = Email (obrigatório)
  organizationalUnit?: string;    // OU = Departamento (opcional)
}

export interface GeneratedCredentials {
  privateKeyPem: string;    // Chave privada PEM (GUARDAR EM SEGURANÇA!)
  csrPem: string;           // CSR para enviar à AT
  publicKeyPem: string;     // Chave pública (para referência)
}

/**
 * Gera um par de chaves RSA 4096-bit e um CSR
 * Requisito AT 2025: chaves RSA devem ter 4096 bits
 */
export function generateCSR(data: CSRData): GeneratedCredentials {
  // Validar campos obrigatórios
  if (!data.nif || data.nif.length !== 9) {
    throw new Error('NIF inválido - deve ter 9 dígitos');
  }
  if (!data.organizationName?.trim()) {
    throw new Error('Nome da empresa/pessoa é obrigatório');
  }
  if (!data.stateOrProvince?.trim()) {
    throw new Error('Distrito é obrigatório');
  }
  if (!data.locality?.trim()) {
    throw new Error('Cidade é obrigatória');
  }
  if (!data.email?.trim() || !data.email.includes('@')) {
    throw new Error('Email válido é obrigatório');
  }

  // Gerar par de chaves RSA 4096-bit (requisito AT 2025)
  const keys = forge.pki.rsa.generateKeyPair(4096);
  
  // Criar CSR
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  
  // Definir atributos do sujeito conforme requisitos AT
  // Ordem: C, ST, L, O, OU, CN, E
  const attrs: forge.pki.CertificateField[] = [
    { name: 'countryName', value: data.countryCode || 'PT' },                   // C
    { name: 'stateOrProvinceName', value: data.stateOrProvince.trim() },        // ST
    { name: 'localityName', value: data.locality.trim() },                      // L
    { name: 'organizationName', value: data.organizationName.trim() },          // O
  ];
  
  // Adicionar OU se fornecido
  if (data.organizationalUnit?.trim()) {
    attrs.push({ 
      name: 'organizationalUnitName', 
      value: data.organizationalUnit.trim() 
    });
  }
  
  // CN = NIF (requisito AT)
  attrs.push({ name: 'commonName', value: data.nif });                          // CN
  
  // Email como atributo do sujeito
  attrs.push({ name: 'emailAddress', value: data.email.trim() });               // E
  
  csr.setSubject(attrs);
  
  // Assinar o CSR com a chave privada (SHA-256)
  csr.sign(keys.privateKey, forge.md.sha256.create());
  
  // Converter para PEM
  const csrPem = forge.pki.certificationRequestToPem(csr);
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey);
  
  return {
    privateKeyPem,
    csrPem,
    publicKeyPem,
  };
}

/**
 * Faz download de um ficheiro de texto
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Valida se um ficheiro PEM é um certificado válido
 */
export function validateCertificate(certPem: string): { valid: boolean; error?: string; info?: any } {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    return {
      valid: true,
      info: {
        subject: cert.subject.getField('CN')?.value,
        issuer: cert.issuer.getField('CN')?.value,
        validFrom: cert.validity.notBefore,
        validTo: cert.validity.notAfter,
      }
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Combina chave privada e certificado num ficheiro PKCS#12 (PFX)
 */
export function createPFX(
  privateKeyPem: string, 
  certPem: string, 
  password: string
): Uint8Array {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const cert = forge.pki.certificateFromPem(certPem);

  // Guardrail: prevent generating an unusable PFX if the user selects the wrong private key.
  // This is the most common real-world failure mode and costs days due to AT certificate delays.
  const privateKeyModulus = (privateKey as any)?.n?.toString(16);
  const certModulus = (cert.publicKey as any)?.n?.toString(16);
  if (!privateKeyModulus || !certModulus) {
    throw new Error('Formato inválido: certificado ou chave privada não são RSA.');
  }
  if (privateKeyModulus !== certModulus) {
    throw new Error(
      'A chave privada não corresponde a este certificado. Use a chave privada que foi descarregada quando gerou o CSR.'
    );
  }
  
  // Criar PKCS#12
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, cert, password, {
    algorithm: '3des',
  });
  
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  
  // Converter para Uint8Array
  const bytes = new Uint8Array(p12Der.length);
  for (let i = 0; i < p12Der.length; i++) {
    bytes[i] = p12Der.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Faz download de ficheiro binário (PFX)
 */
export function downloadBinaryFile(content: Uint8Array, filename: string) {
  const arrayBuffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/x-pkcs12' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
