import { supabase } from '@/integrations/supabase/client';

const SUPPLIER_LOOKUP_BATCH = 50;
const INVOICE_LOOKUP_LIMIT = 500;

type SupplierLike = {
  supplier_nif: string | null;
  supplier_name: string | null;
};

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export function normalizeSupplierName(
  supplierName: string | null | undefined,
  supplierNif?: string | null,
): string | null {
  if (typeof supplierName !== 'string') return null;

  const normalized = supplierName.trim().replace(/\s+/g, ' ');
  if (!normalized) return null;

  if (supplierNif && normalized === supplierNif.trim()) return null;
  if (/^\d{9}$/.test(normalized)) return null;
  if (normalized.length < 3) return null;

  return normalized;
}

export function getSupplierDisplayName(
  supplierName: string | null | undefined,
  supplierNif?: string | null,
  fallback = 'Fornecedor por identificar',
): string {
  return normalizeSupplierName(supplierName, supplierNif) || fallback;
}

async function fetchNamesFromDirectory(nifs: string[]) {
  const nameMap = new Map<string, string>();

  for (const batch of chunkArray(nifs, SUPPLIER_LOOKUP_BATCH)) {
    const { data, error } = await supabase
      .from('supplier_directory')
      .select('nif, name')
      .in('nif', batch)
      .not('name', 'is', null);

    if (error) {
      console.error('Error fetching supplier_directory names:', error);
      continue;
    }

    for (const entry of data || []) {
      const normalizedName = normalizeSupplierName(entry.name, entry.nif);
      if (normalizedName && !nameMap.has(entry.nif)) {
        nameMap.set(entry.nif, normalizedName);
      }
    }
  }

  return nameMap;
}

async function fetchNamesFromInvoices(nifs: string[]) {
  const nameMap = new Map<string, string>();

  for (const batch of chunkArray(nifs, SUPPLIER_LOOKUP_BATCH)) {
    const { data, error } = await supabase
      .from('invoices')
      .select('supplier_nif, supplier_name, created_at')
      .in('supplier_nif', batch)
      .not('supplier_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(INVOICE_LOOKUP_LIMIT);

    if (error) {
      console.error('Error fetching invoice supplier names:', error);
      continue;
    }

    for (const row of data || []) {
      const normalizedName = normalizeSupplierName(row.supplier_name, row.supplier_nif);
      if (normalizedName && !nameMap.has(row.supplier_nif)) {
        nameMap.set(row.supplier_nif, normalizedName);
      }
    }
  }

  return nameMap;
}

async function fetchNamesFromMetrics(nifs: string[]) {
  const nameMap = new Map<string, string>();

  for (const batch of chunkArray(nifs, SUPPLIER_LOOKUP_BATCH)) {
    const { data, error } = await supabase
      .from('ai_metrics')
      .select('supplier_nif, supplier_name')
      .in('supplier_nif', batch)
      .not('supplier_name', 'is', null);

    if (error) {
      console.error('Error fetching AI metric supplier names:', error);
      continue;
    }

    for (const row of data || []) {
      const normalizedName = normalizeSupplierName(row.supplier_name, row.supplier_nif);
      if (normalizedName && !nameMap.has(row.supplier_nif)) {
        nameMap.set(row.supplier_nif, normalizedName);
      }
    }
  }

  return nameMap;
}

export async function buildSupplierNameMap(nifs: Array<string | null | undefined>) {
  const uniqueNifs = Array.from(
    new Set(
      nifs
        .map((nif) => (typeof nif === 'string' ? nif.trim() : ''))
        .filter((nif) => /^\d{9}$/.test(nif) && nif !== '999999990'),
    ),
  );

  if (uniqueNifs.length === 0) {
    return new Map<string, string>();
  }

  const directoryMap = await fetchNamesFromDirectory(uniqueNifs);
  const unresolvedAfterDirectory = uniqueNifs.filter((nif) => !directoryMap.has(nif));
  const invoiceMap = await fetchNamesFromInvoices(unresolvedAfterDirectory);
  const unresolvedAfterInvoices = unresolvedAfterDirectory.filter((nif) => !invoiceMap.has(nif));
  const metricsMap = await fetchNamesFromMetrics(unresolvedAfterInvoices);

  return new Map<string, string>([
    ...directoryMap.entries(),
    ...invoiceMap.entries(),
    ...metricsMap.entries(),
  ]);
}

export async function enrichSupplierNames<T extends SupplierLike>(records: T[]): Promise<T[]> {
  const missingNames = records.filter(
    (record) => !normalizeSupplierName(record.supplier_name, record.supplier_nif),
  );

  if (missingNames.length === 0) {
    return records;
  }

  const nameMap = await buildSupplierNameMap(missingNames.map((record) => record.supplier_nif));
  if (nameMap.size === 0) {
    return records;
  }

  return records.map((record) => {
    const fallbackName =
      !normalizeSupplierName(record.supplier_name, record.supplier_nif) && record.supplier_nif
        ? nameMap.get(record.supplier_nif)
        : null;

    if (!fallbackName) {
      return record;
    }

    return {
      ...record,
      supplier_name: fallbackName,
    };
  });
}
