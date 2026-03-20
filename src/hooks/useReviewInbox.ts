import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReconciliationSummary } from '@/hooks/useReconciliationData';
import { enrichSupplierNames, getSupplierDisplayName } from '@/lib/supplierNameResolver';

// Pending purchase filter — same as useClientFiscalCenter
const PENDING_PURCHASE_FILTER =
  'status.eq.pending,and(status.eq.classified,requires_accountant_validation.is.true),and(status.eq.classified,requires_accountant_validation.is.null)';

export interface ReviewItem {
  id: string;
  label: string;
  sublabel?: string;
  /** Route or null for inline-only actions */
  route?: string;
}

export interface ReviewCategory {
  type: 'pending_purchases' | 'low_confidence' | 'ambiguous_sales' | 'withholding_candidates' | 'reconciliation_divergences';
  label: string;
  /** Exact count from DB (count:'exact'). Always real, never a sentinel. */
  count: number;
  items: ReviewItem[];
  /** Route for "ver todos" link */
  bulkRoute?: string;
}

export interface ReviewInboxData {
  /** Sum of all category counts — always exact from DB */
  totalPending: number;
  categories: ReviewCategory[];
}

interface UseReviewInboxOptions {
  clientId: string | null | undefined;
  fiscalYear: number;
  quarter: number;
  rangeStart: string;
  rangeEnd: string;
  reconciliation?: ReconciliationSummary | null;
}

const MAX_PREVIEW_ITEMS = 5;

// Derive a stable fingerprint from reconciliation data so the queryKey
// changes when divergence statuses change, avoiding stale cache.
function reconciliationFingerprint(r: ReconciliationSummary | null | undefined): string {
  if (!r) return 'none';
  return `${r.purchases.status}|${r.modelo10.status}|${r.ss.status}|${r.withholdings.status}`;
}

export function useReviewInbox(options: UseReviewInboxOptions) {
  const { clientId, fiscalYear, quarter, rangeStart, rangeEnd, reconciliation } = options;

  // Finding 2 fix: include reconciliation fingerprint in queryKey so the
  // cache invalidates when divergence statuses actually change.
  const reconFp = reconciliationFingerprint(reconciliation);

  return useQuery({
    queryKey: ['review-inbox', clientId, fiscalYear, quarter, reconFp],
    queryFn: async (): Promise<ReviewInboxData> => {
      if (!clientId) throw new Error('clientId required');

      // Finding 3 fix: run exact count queries in parallel with preview queries.
      // Counts use head:true (no row data, just count) for efficiency.
      // Previews use limit(MAX_PREVIEW_ITEMS) for the collapsible list.
      const [
        // Exact counts (head:true)
        pendingPurchasesCountRes,
        lowConfidenceCountRes,
        ambiguousSalesCountRes,
        withholdingCandidatesCountRes,
        // Previews (limited rows)
        pendingPurchasesRes,
        lowConfidenceRes,
        ambiguousSalesRes,
        withholdingCandidatesRes,
      ] = await Promise.all([
        // --- Exact counts ---
        // 1. Pending purchases count
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .or(PENDING_PURCHASE_FILTER),

        // 2. Low confidence count
        // Finding 1 fix: aligned with summary card in useClientFiscalCenter —
        // status != 'validated' AND ai_confidence < 80 (not validated+<70)
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .neq('status', 'validated')
          .lt('ai_confidence', 80),

        // 3. Ambiguous sales count
        supabase
          .from('sales_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .or('status.eq.pending,revenue_category.is.null'),

        // 4. Withholding candidates count
        supabase
          .from('at_withholding_candidates')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('fiscal_year', fiscalYear)
          .eq('status', 'pending'),

        // --- Previews ---
        // 1. Pending purchases preview
        supabase
          .from('invoices')
          .select('id, supplier_nif, supplier_name, total_amount, document_date, status, ai_confidence')
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .or(PENDING_PURCHASE_FILTER)
          .order('document_date', { ascending: false })
          .limit(MAX_PREVIEW_ITEMS),

        // 2. Low confidence preview (Finding 1: same universe as count)
        supabase
          .from('invoices')
          .select('id, supplier_nif, supplier_name, total_amount, ai_confidence, ai_classification')
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .neq('status', 'validated')
          .lt('ai_confidence', 80)
          .order('ai_confidence', { ascending: true })
          .limit(MAX_PREVIEW_ITEMS),

        // 3. Ambiguous sales preview
        supabase
          .from('sales_invoices')
          .select('id, customer_name, total_amount, document_date, status, revenue_category, ai_category_confidence')
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .or('status.eq.pending,revenue_category.is.null')
          .order('document_date', { ascending: false })
          .limit(MAX_PREVIEW_ITEMS),

        // 4. Withholding candidates preview
        supabase
          .from('at_withholding_candidates')
          .select('id, beneficiary_name, beneficiary_nif, withholding_amount, confidence_score, income_category')
          .eq('client_id', clientId)
          .eq('fiscal_year', fiscalYear)
          .eq('status', 'pending')
          .order('confidence_score', { ascending: false })
          .limit(MAX_PREVIEW_ITEMS),
      ]);

      const categories: ReviewCategory[] = [];

      // --- 1. Pending purchases ---
      const pendingCount = pendingPurchasesCountRes.count ?? 0;
      const pendingPurchases = await enrichSupplierNames(pendingPurchasesRes.data || []);
      if (pendingCount > 0) {
        categories.push({
          type: 'pending_purchases',
          label: 'Compras por validar',
          count: pendingCount,
          items: pendingPurchases.map(inv => ({
            id: inv.id,
            label: getSupplierDisplayName(inv.supplier_name, inv.supplier_nif),
            sublabel: `${formatCurrency(inv.total_amount)} · ${formatDate(inv.document_date)}${inv.ai_confidence != null ? ` · ${inv.ai_confidence}%` : ''}`,
            route: `/validation?invoice=${inv.id}`,
          })),
          bulkRoute: '/validation',
        });
      }

      // --- 2. Low confidence classifications ---
      // Finding 1: same definition as summary card — not-validated + ai_confidence < 80
      const lowConfCount = lowConfidenceCountRes.count ?? 0;
      const lowConf = await enrichSupplierNames(lowConfidenceRes.data || []);
      if (lowConfCount > 0) {
        categories.push({
          type: 'low_confidence',
          label: 'Baixa confiança IA',
          count: lowConfCount,
          items: lowConf.map(inv => ({
            id: inv.id,
            label: getSupplierDisplayName(inv.supplier_name, inv.supplier_nif),
            sublabel: `${inv.ai_confidence ?? 0}% confiança · ${inv.ai_classification || 'sem classe'}`,
            route: `/validation?invoice=${inv.id}`,
          })),
          bulkRoute: '/validation',
        });
      }

      // --- 3. Ambiguous sales ---
      const ambCount = ambiguousSalesCountRes.count ?? 0;
      const ambSales = ambiguousSalesRes.data || [];
      if (ambCount > 0) {
        categories.push({
          type: 'ambiguous_sales',
          label: 'Vendas por classificar',
          count: ambCount,
          items: ambSales.map(sale => ({
            id: sale.id,
            label: sale.customer_name || 'Sem cliente',
            sublabel: `${formatCurrency(sale.total_amount)} · ${formatDate(sale.document_date)}${!sale.revenue_category ? ' · sem categoria' : ''}`,
            route: '/sales',
          })),
          bulkRoute: '/sales',
        });
      }

      // --- 4. Withholding candidates ---
      const candCount = withholdingCandidatesCountRes.count ?? 0;
      const candidates = withholdingCandidatesRes.data || [];
      if (candCount > 0) {
        categories.push({
          type: 'withholding_candidates',
          label: 'Retenções por rever',
          count: candCount,
          items: candidates.map(c => ({
            id: c.id,
            label: c.beneficiary_name || c.beneficiary_nif || 'Sem beneficiário',
            sublabel: `${formatCurrency(c.withholding_amount)} · Cat. ${c.income_category || '?'} · ${c.confidence_score ?? 0}%`,
          })),
          bulkRoute: '/modelo-10',
        });
      }

      // --- 5. Reconciliation divergences (computed from already-fetched data) ---
      if (reconciliation) {
        const divergences: ReviewItem[] = [];

        if (reconciliation.purchases.status === 'warning' || reconciliation.purchases.status === 'error') {
          divergences.push({
            id: 'recon-purchases',
            label: 'AT vs App — Compras',
            sublabel: `AT: ${reconciliation.purchases.atCount} · App: ${reconciliation.purchases.uploadCount}`,
            route: '/reconciliation',
          });
        }
        if (reconciliation.modelo10.status === 'warning' || reconciliation.modelo10.status === 'error') {
          divergences.push({
            id: 'recon-modelo10',
            label: 'Modelo 10 — Fonte divergente',
            sublabel: `${reconciliation.modelo10.nifMismatchCount} NIF(s) com delta >€1`,
            route: '/reconciliation',
          });
        }
        if (reconciliation.ss.status === 'warning' || reconciliation.ss.status === 'error') {
          const delta = reconciliation.ss.delta;
          divergences.push({
            id: 'recon-ss',
            label: 'SS — Vendas vs Declaração',
            sublabel: reconciliation.ss.declaredRevenue == null
              ? 'Sem declaração SS para o trimestre'
              : `Delta: ${formatCurrency(delta)}`,
            route: '/reconciliation',
          });
        }
        if (reconciliation.withholdings.status === 'warning') {
          divergences.push({
            id: 'recon-withholdings',
            label: 'Retenções — Candidatos pendentes',
            sublabel: `${reconciliation.withholdings.pendingCandidates} por rever`,
            route: '/reconciliation',
          });
        }

        if (divergences.length > 0) {
          categories.push({
            type: 'reconciliation_divergences',
            label: 'Divergências de reconciliação',
            count: divergences.length,
            items: divergences,
            bulkRoute: '/reconciliation',
          });
        }
      }

      // Finding 3 fix: totalPending is the sum of exact DB counts, never preview-limited.
      const totalPending = categories.reduce((sum, cat) => sum + cat.count, 0);

      return { totalPending, categories };
    },
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '€0,00';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}
