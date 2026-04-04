import { supabase } from '@/integrations/supabase/client';
import { normalizeSupplierName } from '@/lib/supplierNameResolver';

/**
 * Session-level set of invoice IDs that have already been written back.
 * Prevents redundant updates on re-renders within the same browser session.
 */
const writtenBackIds = new Set<string>();

interface WriteBackRecord {
  id: string;
  supplier_nif: string | null;
  supplier_name: string | null;
}

/**
 * Write enriched supplier names back to the invoices table for records
 * that previously had no supplier_name. Fire-and-forget — does not block rendering.
 *
 * @param originalRecords - The records as fetched from the database (before enrichment)
 * @param enrichedRecords - The records after enrichSupplierNames() has resolved names
 */
export function writeBackSupplierNames(
  originalRecords: readonly WriteBackRecord[],
  enrichedRecords: readonly WriteBackRecord[],
): void {
  const originalById = new Map(originalRecords.map(r => [r.id, r]));

  const toUpdate: Array<{ id: string; supplier_name: string }> = [];

  for (const enriched of enrichedRecords) {
    // Skip if already written back this session
    if (writtenBackIds.has(enriched.id)) continue;

    const resolvedName = normalizeSupplierName(enriched.supplier_name, enriched.supplier_nif);
    if (!resolvedName) continue;

    const original = originalById.get(enriched.id);
    if (!original) continue;

    // Only write back if the original had no valid supplier_name
    const originalName = normalizeSupplierName(original.supplier_name, original.supplier_nif);
    if (originalName) continue;

    toUpdate.push({ id: enriched.id, supplier_name: resolvedName });
  }

  if (toUpdate.length === 0) return;

  // Mark as written back immediately to prevent duplicate writes on re-render
  for (const item of toUpdate) {
    writtenBackIds.add(item.id);
  }

  // Fire-and-forget batch update
  Promise.all(
    toUpdate.map(item =>
      supabase
        .from('invoices')
        .update({ supplier_name: item.supplier_name })
        .eq('id', item.id),
    ),
  ).catch(err => {
    // On failure, remove from set so a future render can retry
    for (const item of toUpdate) {
      writtenBackIds.delete(item.id);
    }
    console.error('Supplier name write-back failed:', err);
  });
}
