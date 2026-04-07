# SS Declaration Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the SS declaration tab into a single-page 3-section layout with monthly revenue breakdown, optimized for accountant batch processing of ~242 clients.

**Architecture:** The calculation layer (`useSocialSecurity`, `socialSecurityRevenue.ts`, `ssCoefficients.ts`) stays untouched. We add a `monthlyBreakdown` field to the existing `totals` useMemo, extract two new presentational components (`SSRevenueBreakdown`, `SSCalculationSummary`), and replace the declaration tab content in `SocialSecurity.tsx`. Tabs go from 5 to 3 (Declaracao, Importar, Historico).

**Tech Stack:** React 18, TypeScript, Vitest, shadcn/ui (Table, Card, Badge, Select, Button), Tailwind CSS, Supabase client

---

### Task 1: Add monthly breakdown to useSocialSecurity totals

**Files:**
- Modify: `src/hooks/useSocialSecurity.tsx` (the `totals` useMemo at line ~448)
- Create: `src/lib/__tests__/ssMonthlyBreakdown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/ssMonthlyBreakdown.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildMonthlyBreakdown } from '@/lib/ssMonthlyBreakdown';

describe('buildMonthlyBreakdown', () => {
  it('groups sales invoices by month and category', () => {
    const invoices = [
      { document_date: '2026-01-15', total_amount: 1230, total_vat: 230, base_standard: 1000, base_reduced: 0, base_intermediate: 0, base_exempt: 0, revenue_category: null, document_type: 'FR' },
      { document_date: '2026-02-10', total_amount: 615, total_vat: 115, base_standard: 500, base_reduced: 0, base_intermediate: 0, base_exempt: 0, revenue_category: null, document_type: 'FR' },
      { document_date: '2026-03-20', total_amount: 246, total_vat: 46, base_standard: 200, base_reduced: 0, base_intermediate: 0, base_exempt: 0, revenue_category: 'vendas', document_type: 'FT' },
    ];
    const result = buildMonthlyBreakdown(invoices, [], '2026-Q1');

    expect(result['2026-01'].prestacao_servicos).toBe(1000);
    expect(result['2026-02'].prestacao_servicos).toBe(500);
    expect(result['2026-03'].vendas).toBe(200);
    expect(result['2026-03'].prestacao_servicos).toBeUndefined();
  });

  it('returns 3 month keys even with no invoices', () => {
    const result = buildMonthlyBreakdown([], [], '2025-Q4');
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(['2025-10', '2025-11', '2025-12']);
  });

  it('distributes manual entries evenly across 3 months', () => {
    const manualEntries = [
      { category: 'prestacao_servicos', amount: 3000 },
    ];
    const result = buildMonthlyBreakdown([], manualEntries, '2026-Q1');
    expect(result['2026-01'].prestacao_servicos).toBe(1000);
    expect(result['2026-02'].prestacao_servicos).toBe(1000);
    expect(result['2026-03'].prestacao_servicos).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/ssMonthlyBreakdown.test.ts`
Expected: FAIL — module `@/lib/ssMonthlyBreakdown` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/ssMonthlyBreakdown.ts`:

```typescript
import {
  getSalesInvoiceRevenueAmount,
  getSalesInvoiceRevenueCategory,
  type SocialSecuritySalesInvoiceLike,
} from '@/lib/socialSecurityRevenue';

interface ManualEntryLike {
  category: string;
  amount: number | string;
}

export type MonthlyBreakdown = Record<string, Record<string, number>>;

export function buildMonthlyBreakdown(
  salesInvoices: SocialSecuritySalesInvoiceLike[],
  manualEntries: ManualEntryLike[],
  quarter: string,
): MonthlyBreakdown {
  const [yearStr, qStr] = quarter.split('-Q');
  const year = Number(yearStr);
  const q = Number(qStr);
  const startMonth = (q - 1) * 3 + 1;

  const breakdown: MonthlyBreakdown = {};
  for (let m = 0; m < 3; m++) {
    const monthKey = `${year}-${String(startMonth + m).padStart(2, '0')}`;
    breakdown[monthKey] = {};
  }

  const monthKeys = Object.keys(breakdown);

  salesInvoices.forEach((inv) => {
    const amount = getSalesInvoiceRevenueAmount(inv);
    if (amount <= 0) return;
    const category = getSalesInvoiceRevenueCategory(inv);
    const monthKey = ((inv as { document_date?: string | null }).document_date || '').slice(0, 7);
    if (!breakdown[monthKey]) return;
    breakdown[monthKey][category] = (breakdown[monthKey][category] || 0) + Math.round(amount * 100) / 100;
  });

  manualEntries.forEach((entry) => {
    const perMonth = Math.round((Number(entry.amount) / 3) * 100) / 100;
    monthKeys.forEach((monthKey) => {
      breakdown[monthKey][entry.category] = (breakdown[monthKey][entry.category] || 0) + perMonth;
    });
  });

  return breakdown;
}

export function getMonthLabel(monthKey: string): string {
  const MONTHS_PT: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março',
    '04': 'Abril', '05': 'Maio', '06': 'Junho',
    '07': 'Julho', '08': 'Agosto', '09': 'Setembro',
    '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
  };
  const mm = monthKey.split('-')[1];
  return MONTHS_PT[mm] || mm;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/ssMonthlyBreakdown.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Wire into useSocialSecurity**

In `src/hooks/useSocialSecurity.tsx`, inside the `totals` useMemo (after line ~485), add:

```typescript
import { buildMonthlyBreakdown, type MonthlyBreakdown } from '@/lib/ssMonthlyBreakdown';

// ... inside the useMemo, before the return:
const monthlyBreakdown = buildMonthlyBreakdown(
  salesInvoices,
  revenueEntries.map(e => ({ category: e.category, amount: e.amount })),
  quarter,
);

return {
  byCategory,
  total,
  relevantIncome,
  salesInvoicesTotal: salesInvoices.reduce((sum, inv) => sum + getSalesInvoiceRevenueAmount(inv), 0),
  salesInvoicesCount: salesInvoices.length,
  monthlyBreakdown,
};
```

Add `quarter` to the useMemo dependency array (alongside existing `revenueEntries, salesInvoices`).

- [ ] **Step 6: Run full test suite**

Run: `npm test -- --run`
Expected: All 905+ tests pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add src/lib/ssMonthlyBreakdown.ts src/lib/__tests__/ssMonthlyBreakdown.test.ts src/hooks/useSocialSecurity.tsx
git commit -m "feat(ss): add monthly breakdown by category to useSocialSecurity totals"
```

---

### Task 2: Create SSRevenueBreakdown component

**Files:**
- Create: `src/components/social-security/SSRevenueBreakdown.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/social-security/SSRevenueBreakdown.tsx`:

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SS_REVENUE_CATEGORIES, getSSCoefficient } from '@/lib/ssCoefficients';
import { getMonthLabel, type MonthlyBreakdown } from '@/lib/ssMonthlyBreakdown';
import { FileSpreadsheet } from 'lucide-react';

interface SSRevenueBreakdownProps {
  monthlyBreakdown: MonthlyBreakdown;
  quarterLabel: string;
}

export function SSRevenueBreakdown({ monthlyBreakdown, quarterLabel }: SSRevenueBreakdownProps) {
  const monthKeys = Object.keys(monthlyBreakdown).sort();

  // Find all categories with non-zero values in any month
  const activeCategories = SS_REVENUE_CATEGORIES.filter((cat) =>
    monthKeys.some((mk) => (monthlyBreakdown[mk]?.[cat.value] || 0) > 0),
  );

  // If nothing at all, show empty state
  if (activeCategories.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Sem rendimentos registados para {quarterLabel} — importe recibos verdes ou adicione manualmente.
        </CardContent>
      </Card>
    );
  }

  const fmt = (v: number) => v.toFixed(2);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Rendimentos por mês</CardTitle>
          <Badge variant="outline" className="ml-auto text-xs">{quarterLabel}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Valores sem IVA (base tributável) — calculados das facturas de vendas validadas
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              {monthKeys.map((mk) => (
                <TableHead key={mk} className="text-right">{getMonthLabel(mk)}</TableHead>
              ))}
              <TableHead className="text-right font-semibold">Total</TableHead>
              <TableHead className="text-center">Coef.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeCategories.map((cat) => {
              const monthValues = monthKeys.map((mk) => monthlyBreakdown[mk]?.[cat.value] || 0);
              const rowTotal = monthValues.reduce((s, v) => s + v, 0);
              const coeff = getSSCoefficient(cat.value);
              return (
                <TableRow key={cat.value}>
                  <TableCell className="font-medium text-sm">{cat.label}</TableCell>
                  {monthValues.map((val, idx) => (
                    <TableCell key={monthKeys[idx]} className="text-right tabular-nums text-sm">
                      {fmt(val)}€
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold tabular-nums text-sm">
                    {fmt(rowTotal)}€
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">{(coeff * 100).toFixed(0)}%</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Totals row */}
            <TableRow className="border-t-2 font-semibold">
              <TableCell>TOTAL</TableCell>
              {monthKeys.map((mk) => {
                const monthTotal = Object.values(monthlyBreakdown[mk] || {}).reduce((s, v) => s + v, 0);
                return (
                  <TableCell key={mk} className="text-right tabular-nums">{fmt(monthTotal)}€</TableCell>
                );
              })}
              <TableCell className="text-right tabular-nums">
                {fmt(monthKeys.reduce((s, mk) => s + Object.values(monthlyBreakdown[mk] || {}).reduce((a, b) => a + b, 0), 0))}€
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/social-security/SSRevenueBreakdown.tsx
git commit -m "feat(ss): add SSRevenueBreakdown monthly table component"
```

---

### Task 3: Create SSCalculationSummary component

**Files:**
- Create: `src/components/social-security/SSCalculationSummary.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/social-security/SSCalculationSummary.tsx`:

```tsx
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, ExternalLink, CheckCircle, Euro, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import type { MonthlyBreakdown } from '@/lib/ssMonthlyBreakdown';
import { getMonthLabel } from '@/lib/ssMonthlyBreakdown';
import { SS_REVENUE_CATEGORIES } from '@/lib/ssCoefficients';

interface SSCalculationSummaryProps {
  totals: {
    total: number;
    relevantIncome: number;
  };
  contributionBase: number;
  contributionAmount: number;
  contributionRate: number;
  variationPercent: number;
  onVariationChange: (percent: number) => void;
  isExempt: boolean;
  exemptReason: string;
  quarterLabel: string;
  clientName: string;
  clientNif: string;
  monthlyBreakdown: MonthlyBreakdown;
  onMarkSubmitted: () => void;
  isSubmittedLocked: boolean;
  isSaving: boolean;
}

function buildClipboardText(props: SSCalculationSummaryProps): string {
  const { quarterLabel, clientName, clientNif, monthlyBreakdown, variationPercent, contributionAmount } = props;
  const monthKeys = Object.keys(monthlyBreakdown).sort();
  const activeCategories = SS_REVENUE_CATEGORIES.filter((cat) =>
    monthKeys.some((mk) => (monthlyBreakdown[mk]?.[cat.value] || 0) > 0),
  );

  let text = `Declaração Trimestral SS — ${quarterLabel}\nCliente: ${clientName} (NIF ${clientNif})\n\n`;

  activeCategories.forEach((cat) => {
    text += `${cat.label}:\n`;
    monthKeys.forEach((mk) => {
      const val = monthlyBreakdown[mk]?.[cat.value] || 0;
      text += `  ${getMonthLabel(mk)}: ${val.toFixed(2)} EUR\n`;
    });
    text += '\n';
  });

  text += `Variação: ${variationPercent > 0 ? '+' : ''}${variationPercent}%\n`;
  text += `Contribuição mensal prevista: ${contributionAmount.toFixed(2)} EUR\n`;
  return text;
}

export function SSCalculationSummary(props: SSCalculationSummaryProps) {
  const {
    totals, contributionBase, contributionAmount, contributionRate,
    variationPercent, onVariationChange, isExempt, exemptReason,
    onMarkSubmitted, isSubmittedLocked, isSaving,
  } = props;

  if (isExempt) {
    return (
      <Card className="border-green-500/30 bg-green-50/50">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="font-medium">Contribuição isenta</p>
            <p className="text-sm text-muted-foreground">{exemptReason}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="pt-5 space-y-4">
        {/* Calculation line */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Rendimento relevante</p>
            <p className="font-semibold">{totals.relevantIncome.toFixed(2)}€</p>
          </div>
          <div>
            <p className="text-muted-foreground">Base incidência</p>
            <p className="font-semibold">{contributionBase.toFixed(2)}€</p>
          </div>
          <div>
            <p className="text-muted-foreground">Variação</p>
            <Select
              value={String(variationPercent)}
              onValueChange={(v) => onVariationChange(Number(v))}
              disabled={isSubmittedLocked}
            >
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-25">-25%</SelectItem>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="25">+25%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col items-end">
            <p className="text-muted-foreground">Contribuição/mês</p>
            <p className="text-2xl font-bold text-primary">{contributionAmount.toFixed(2)}€</p>
            <p className="text-xs text-muted-foreground">{contributionRate}%</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              navigator.clipboard.writeText(buildClipboardText(props));
              toast.success('Valores copiados para SS Directa');
            }}
          >
            <Copy className="h-4 w-4" />
            Copiar para SS Directa
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open('https://app.seg-social.pt/', '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir SS Directa
          </Button>
          <Button
            size="sm"
            className="gap-2 ml-auto"
            onClick={onMarkSubmitted}
            disabled={isSubmittedLocked || isSaving}
          >
            <CheckCircle className="h-4 w-4" />
            {isSubmittedLocked ? 'Submetido' : 'Marcar submetido'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/social-security/SSCalculationSummary.tsx
git commit -m "feat(ss): add SSCalculationSummary compact component with copy-to-clipboard"
```

---

### Task 4: Restructure SocialSecurity.tsx declaration tab

**Files:**
- Modify: `src/pages/SocialSecurity.tsx`

- [ ] **Step 1: Add imports for new components**

At the top of `SocialSecurity.tsx`, add:

```typescript
import { SSRevenueBreakdown } from '@/components/social-security/SSRevenueBreakdown';
import { SSCalculationSummary } from '@/components/social-security/SSCalculationSummary';
```

- [ ] **Step 2: Replace the 5-tab layout with 3-tab layout**

Replace the `<Tabs>` block (approximately lines 469-491) with:

```tsx
<Tabs defaultValue="declaration" className="space-y-6">
  <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
    <TabsTrigger value="declaration" className="gap-2">
      <Calculator className="h-4 w-4" />
      <span className="hidden sm:inline">Declaração</span>
    </TabsTrigger>
    <TabsTrigger value="import" className="gap-2">
      <Upload className="h-4 w-4" />
      <span className="hidden sm:inline">Importar</span>
    </TabsTrigger>
    <TabsTrigger value="history" className="gap-2">
      <History className="h-4 w-4" />
      <span className="hidden sm:inline">Histórico</span>
    </TabsTrigger>
  </TabsList>
```

- [ ] **Step 3: Replace declaration tab content with 3 sections**

Replace the entire `<TabsContent value="declaration">` block (lines ~493-890) with:

```tsx
<TabsContent value="declaration" className="space-y-4">
  {/* Section 1: Status */}
  {calculatedContribution.isExempt ? (
    <SSCalculationSummary
      totals={totals}
      contributionBase={0}
      contributionAmount={0}
      contributionRate={contributionRate}
      variationPercent={variationPercent}
      onVariationChange={setVariationPercent}
      isExempt={true}
      exemptReason={calculatedContribution.exemptReason}
      quarterLabel={getLabel(quarter)}
      clientName={selectedClient?.full_name || profile?.full_name || ''}
      clientNif={selectedClient?.nif || profile?.nif || ''}
      monthlyBreakdown={totals.monthlyBreakdown}
      onMarkSubmitted={() => handleSaveDeclaration('submitted')}
      isSubmittedLocked={isSubmittedQuarterLocked}
      isSaving={isSavingDeclaration}
    />
  ) : (
    <>
      {/* Section 2: Monthly Revenue Breakdown */}
      <SSRevenueBreakdown
        monthlyBreakdown={totals.monthlyBreakdown}
        quarterLabel={getLabel(quarter)}
      />

      {/* Manual entry button */}
      <div className="flex justify-end">
        <Dialog
          open={addDialogOpen}
          onOpenChange={(nextOpen) => {
            if (nextOpen && isSubmittedQuarterLocked) {
              toast.error(readOnlyQuarterMessage);
              return;
            }
            if (nextOpen && detectedCategory) {
              setNewCategory(detectedCategory.category);
            }
            setAddDialogOpen(nextOpen);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" disabled={isSubmittedQuarterLocked}>
              <Plus className="h-4 w-4" />
              Adicionar rendimento manual
            </Button>
          </DialogTrigger>
          {/* Keep existing DialogContent for adding revenue — lines ~778-836 */}
        </Dialog>
      </div>

      {/* Section 3: Calculation + Actions */}
      <SSCalculationSummary
        totals={totals}
        contributionBase={contributionBase}
        contributionAmount={contributionAmount}
        contributionRate={contributionRate}
        variationPercent={variationPercent}
        onVariationChange={setVariationPercent}
        isExempt={false}
        exemptReason=""
        quarterLabel={getLabel(quarter)}
        clientName={selectedClient?.full_name || profile?.full_name || ''}
        clientNif={selectedClient?.nif || profile?.nif || ''}
        monthlyBreakdown={totals.monthlyBreakdown}
        onMarkSubmitted={() => handleSaveDeclaration('submitted')}
        isSubmittedLocked={isSubmittedQuarterLocked}
        isSaving={isSavingDeclaration}
      />
    </>
  )}
</TabsContent>
```

- [ ] **Step 4: Merge charts into history tab**

Replace the separate `charts` and `history` TabsContent blocks with a single combined one:

```tsx
<TabsContent value="history" className="space-y-6">
  <RevenueCharts
    declarationsHistory={declarationsHistory}
    getQuarterLabel={getLabel}
  />
  {/* Existing declarations history table from the old "history" tab */}
  {declarationsHistory.length > 0 && (
    <Card>
      <CardHeader>
        <CardTitle>Declarações Anteriores</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trimestre</TableHead>
              <TableHead className="text-right">Rendimento</TableHead>
              <TableHead className="text-right">Contribuição</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Submetida</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {declarationsHistory.map((decl) => (
              <TableRow key={decl.id}>
                <TableCell className="font-medium">{getLabel(decl.period_quarter)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(decl.total_revenue).toFixed(2)}€</TableCell>
                <TableCell className="text-right tabular-nums">{Number(decl.contribution_amount).toFixed(2)}€</TableCell>
                <TableCell>
                  <Badge variant={decl.status === 'submitted' ? 'default' : 'secondary'}>
                    {decl.status === 'submitted' ? 'Submetida' : 'Rascunho'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {decl.submitted_at ? new Date(decl.submitted_at).toLocaleDateString('pt-PT') : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )}
</TabsContent>
```

- [ ] **Step 5: Remove the old submit tab content**

Delete the `<TabsContent value="submit">` and `<TabsContent value="charts">` blocks entirely. The SubmissionGuide functionality is now in SSCalculationSummary (copy + open portal + mark submitted).

- [ ] **Step 6: Clean up unused imports**

Remove imports that are no longer used after the tab consolidation: `SubmissionGuide`, `PortalLinks`, `Send`, `BarChart3` (if no longer referenced).

- [ ] **Step 7: Run full verification**

```bash
npm test -- --run
npm run lint
npm run build
```

Expected: All tests pass, no lint errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/pages/SocialSecurity.tsx
git commit -m "feat(ss): restructure declaration tab — 3-section layout with monthly breakdown

- Section 1: client exempt status badge
- Section 2: monthly revenue breakdown by category (new SSRevenueBreakdown)
- Section 3: calculation + copy-to-clipboard + mark submitted (new SSCalculationSummary)
- Tabs: 5 → 3 (Declaração, Importar, Histórico)
- Charts merged into Histórico tab
- Submit tab removed (actions inline in Section 3)"
```

---

### Task 5: Final integration test and push

**Files:**
- None created — verification only

- [ ] **Step 1: Run full test suite**

```bash
npm test -- --run
```

Expected: 905+ tests pass.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

Expected: CI passes, Vercel deploys.

- [ ] **Step 5: Verify CI**

```bash
gh run list --limit 1
```

Expected: `completed success`.
