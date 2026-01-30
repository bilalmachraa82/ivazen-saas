/**
 * Emitter Data Storage
 * Stores and retrieves emitter (issuing company) information for Modelo 10 declarations
 *
 * This data is used in:
 * - PDF declaration header
 * - Excel export header
 * - Signature section
 */

// Storage key (no sensitive PII stored)
const EMITTER_STORAGE_KEY = 'ivazen_emitter_data';

export interface EmitterData {
  // Company Information
  companyName: string;        // Nome da empresa (ex: "Accounting Advantage")
  companyNIF: string;         // NIF da empresa
  companyAddress: string;     // Morada
  companyPostalCode: string;  // Código postal
  companyCity: string;        // Cidade

  // Contact Information
  email: string;
  phone: string;

  // Responsible Person
  responsibleName: string;    // Nome do responsável (ex: "Adélia Gaspar")
  responsibleRole: string;    // Cargo (ex: "Técnica Oficial de Contas")

  // Optional
  logoUrl?: string;           // URL do logo (se existir)
  crcNumber?: string;         // Número da Ordem dos Contabilistas
}

export const DEFAULT_EMITTER: EmitterData = {
  companyName: '',
  companyNIF: '',
  companyAddress: '',
  companyPostalCode: '',
  companyCity: '',
  email: '',
  phone: '',
  responsibleName: '',
  responsibleRole: 'Técnico Oficial de Contas',
};

/**
 * Save emitter data to localStorage
 */
export function saveEmitterData(data: EmitterData): void {
  try {
    // Validate NIF format (9 digits)
    if (data.companyNIF && !/^\d{9}$/.test(data.companyNIF.replace(/\s/g, ''))) {
      console.warn('EmitterStorage: NIF format may be invalid');
    }

    localStorage.setItem(EMITTER_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save emitter data');
  }
}

/**
 * Load emitter data from localStorage
 */
export function loadEmitterData(): EmitterData {
  try {
    const stored = localStorage.getItem(EMITTER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_EMITTER, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load emitter data');
  }
  return DEFAULT_EMITTER;
}

/**
 * Clear emitter data from localStorage
 */
export function clearEmitterData(): void {
  try {
    localStorage.removeItem(EMITTER_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear emitter data');
  }
}

/**
 * Check if emitter data is configured
 */
export function hasEmitterData(): boolean {
  const data = loadEmitterData();
  return !!(data.companyName && data.companyNIF);
}

/**
 * Format emitter address for display
 */
export function formatEmitterAddress(data: EmitterData): string {
  const parts = [
    data.companyAddress,
    data.companyPostalCode && data.companyCity
      ? `${data.companyPostalCode} ${data.companyCity}`
      : data.companyCity,
  ].filter(Boolean);

  return parts.join(', ');
}

/**
 * Format emitter for PDF/Excel header
 */
export function formatEmitterHeader(data: EmitterData): string[] {
  const lines: string[] = [];

  if (data.companyName) {
    lines.push(data.companyName);
  }
  if (data.companyAddress) {
    lines.push(data.companyAddress);
  }
  if (data.companyPostalCode || data.companyCity) {
    lines.push(`${data.companyPostalCode} ${data.companyCity}`.trim());
  }
  if (data.companyNIF) {
    lines.push(`NIF: ${data.companyNIF}`);
  }
  if (data.email || data.phone) {
    const contact = [data.email, data.phone].filter(Boolean).join(' | ');
    lines.push(contact);
  }

  return lines;
}
