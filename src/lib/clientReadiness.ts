/**
 * Client readiness computation — pure logic, no side effects.
 *
 * Determines the operational state of a client based on available data:
 * invoices (compras) + sales (vendas) + withholdings (retenções) + AT credential status.
 */

export type ClientReadiness =
  | 'ready'
  | 'partial'
  | 'no_data'
  | 'no_credentials'
  | 'blocked'
  | 'needs_import';

export interface ClientReadinessInput {
  hasCredentials: boolean;
  invoiceCount: number;      // compras (purchases)
  salesCount: number;        // vendas (sales_invoices)
  withholdingsCount: number; // retenções (tax_withholdings)
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

export function computeClientReadiness(input: ClientReadinessInput): ClientReadiness {
  const { hasCredentials, invoiceCount, salesCount, withholdingsCount, lastSyncStatus, lastSyncError } = input;
  const hasData = invoiceCount + salesCount + withholdingsCount > 0;

  // ── No AT credentials ──
  if (!hasCredentials) {
    // Might still have data from CSV/manual import
    return hasData ? 'partial' : 'no_credentials';
  }

  // ── Auth / hard errors ──
  const isAuthError =
    !!lastSyncError &&
    /auth|credential|401|forbidden|certificate/i.test(lastSyncError);

  if (isAuthError) {
    return hasData ? 'partial' : 'blocked';
  }

  // ── Never synced ──
  if (!lastSyncStatus || lastSyncStatus === 'never') {
    return hasData ? 'ready' : 'needs_import';
  }

  // ── Sync had errors ──
  if (lastSyncStatus === 'error') {
    return hasData ? 'partial' : 'blocked';
  }

  // ── Has data ──
  if (hasData) {
    return 'ready';
  }

  // ── Synced OK but zero documents ──
  return 'no_data';
}

// ── Visual config ──

export interface ReadinessConfig {
  label: string;
  dot: string;       // Tailwind classes for the small dot
  badge: string;     // Tailwind classes for a badge
  description: string;
}

export const readinessConfig: Record<ClientReadiness, ReadinessConfig> = {
  ready: {
    label: 'Pronto',
    dot: 'bg-green-500',
    badge: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800',
    description: 'Dados disponíveis para trabalhar',
  },
  partial: {
    label: 'Parcial',
    dot: 'bg-amber-500',
    badge: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
    description: 'Tem dados mas com pendências',
  },
  no_data: {
    label: 'Sem dados',
    dot: 'bg-slate-400',
    badge: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900 dark:border-slate-700',
    description: 'Sync OK mas sem documentos',
  },
  no_credentials: {
    label: 'Sem credenciais',
    dot: 'bg-orange-400',
    badge: 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-800',
    description: 'Credenciais AT não configuradas',
  },
  blocked: {
    label: 'Bloqueado',
    dot: 'bg-red-500',
    badge: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800',
    description: 'Erro de auth ou problema técnico',
  },
  needs_import: {
    label: 'Importar',
    dot: 'bg-blue-500',
    badge: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800',
    description: 'Tem credenciais, falta importação inicial',
  },
};

/** Order for display — most actionable first */
export const readinessOrder: ClientReadiness[] = [
  'ready',
  'partial',
  'needs_import',
  'no_data',
  'no_credentials',
  'blocked',
];
