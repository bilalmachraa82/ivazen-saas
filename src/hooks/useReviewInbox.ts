import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReconciliationSummary } from '@/hooks/useReconciliationData';

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
  count: number;
  items: ReviewItem[];
  /** Route for "ver todos" link */
  bulkRoute?: string;
}

export interface ReviewInboxData {
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

export function useReviewInbox(options: UseReviewInboxOptions) {
  const { clientId, fiscalYear, quarter, rangeStart, rangeEnd, reconciliation } = options;

  return useQuery({
    queryKey: ['review-inbox', clientId, fiscalYear, quarter],
    queryFn: async (): Promise<ReviewInboxData> => {
      if (!clientId) throw new Error('clientId required');

      const [
        pendingPurchasesRes,
        lowConfidenceRes,
        ambiguousSalesRes,
        withholdingCandidatesRes,
      ] = await Promise.all([
        // 1. Pending purchases (not yet validated by accountant)
        supabase
          .from('invoices')
          .select('id, issuer_name, total_amount, document_date, status, ai_confidence')
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .or(PENDING_PURCHASE_FILTER)
          .order('document_date', { ascending: false })
          .limit(MAX_PREVIEW_ITEMS + 1), // +1 to know if there are more

        // 2. Low confidence classifications (validated but ai_confidence < 70)
        supabase
          .from('invoices')
          .select('id, issuer_name, total_amount, ai_confidence, ai_classification')
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .eq('status', 'validated')
          .lt('ai_confidence', 70)
          .order('ai_confidence', { ascending: true })
          .limit(MAX_PREVIEW_ITEMS + 1),

        // 3. Ambiguous sales (pending or missing revenue_category)
        supabase
          .from('sales_invoices')
          .select('id, customer_name, total_amount, document_date, status, revenue_category, ai_category_confidence')
          .eq('client_id', clientId)
          .gte('document_date', rangeStart)
          .lte('document_date', rangeEnd)
          .or('status.eq.pending,revenue_category.is.null')
          .order('document_date', { ascending: false })
          .limit(MAX_PREVIEW_ITEMS + 1),

        // 4. Withholding candidates pending review
        supabase
          .from('at_withholding_candidates')
          .select('id, beneficiary_name, beneficiary_nif, withholding_amount, confidence_score, income_category')
          .eq('client_id', clientId)
          .eq('fiscal_year', fiscalYear)
          .eq('status', 'pending')
          .order('confidence_score', { ascending: false })
          .limit(MAX_PREVIEW_ITEMS + 1),
      ]);

      const categories: ReviewCategory[] = [];

      // --- 1. Pending purchases ---
      const pendingPurchases = pendingPurchasesRes.data || [];
      if (pendingPurchases.length > 0) {
        categories.push({
          type: 'pending_purchases',
          label: 'Compras por validar',
          count: pendingPurchases.length > MAX_PREVIEW_ITEMS
            ? MAX_PREVIEW_ITEMS // signal "5+"
            : pendingPurchases.length,
          items: pendingPurchases.slice(0, MAX_PREVIEW_ITEMS).map(inv => ({
            id: inv.id,
            label: inv.issuer_name || 'Sem emitente',
            sublabel: `${formatCurrency(inv.total_amount)} · ${formatDate(inv.document_date)}${inv.ai_confidence != null ? ` · ${inv.ai_confidence}%` : ''}`,
            route: '/validation',
          })),
          bulkRoute: '/validation',
        });
        // Adjust count if we got more than preview
        if (pendingPurchases.length > MAX_PREVIEW_ITEMS) {
          categories[categories.length - 1].count = -1; // sentinel for "5+"
        }
      }

      // --- 2. Low confidence classifications ---
      const lowConf = lowConfidenceRes.data || [];
      if (lowConf.length > 0) {
        categories.push({
          type: 'low_confidence',
          label: 'Classificações duvidosas',
          count: lowConf.length > MAX_PREVIEW_ITEMS ? -1 : lowConf.length,
          items: lowConf.slice(0, MAX_PREVIEW_ITEMS).map(inv => ({
            id: inv.id,
            label: inv.issuer_name || 'Sem emitente',
            sublabel: `${inv.ai_confidence}% confiança · ${inv.ai_classification || 'sem classe'}`,
            route: '/validation',
          })),
          bulkRoute: '/validation',
        });
      }

      // --- 3. Ambiguous sales ---
      const ambSales = ambiguousSalesRes.data || [];
      if (ambSales.length > 0) {
        categories.push({
          type: 'ambiguous_sales',
          label: 'Vendas por classificar',
          count: ambSales.length > MAX_PREVIEW_ITEMS ? -1 : ambSales.length,
          items: ambSales.slice(0, MAX_PREVIEW_ITEMS).map(sale => ({
            id: sale.id,
            label: sale.customer_name || 'Sem cliente',
            sublabel: `${formatCurrency(sale.total_amount)} · ${formatDate(sale.document_date)}${!sale.revenue_category ? ' · sem categoria' : ''}`,
            route: '/sales',
          })),
          bulkRoute: '/sales',
        });
      }

      // --- 4. Withholding candidates ---
      const candidates = withholdingCandidatesRes.data || [];
      if (candidates.length > 0) {
        categories.push({
          type: 'withholding_candidates',
          label: 'Retenções por rever',
          count: candidates.length > MAX_PREVIEW_ITEMS ? -1 : candidates.length,
          items: candidates.slice(0, MAX_PREVIEW_ITEMS).map(c => ({
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

      const totalPending = categories.reduce(
        (sum, cat) => sum + (cat.count === -1 ? MAX_PREVIEW_ITEMS + 1 : cat.count),
        0,
      );

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
