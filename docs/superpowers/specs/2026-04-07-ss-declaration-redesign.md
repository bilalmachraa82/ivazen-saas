# SS Declaration Page Redesign — Single-Page Accountant-Optimized Flow

**Date:** 2026-04-07
**Status:** Draft
**Goal:** Restructure the Social Security declaration page from a cluttered multi-tab dashboard into a streamlined single-page view with monthly breakdown, optimized for accountants processing ~242 clients per quarter.

---

## Problem

The current SS page (`src/pages/SocialSecurity.tsx`) shows quarterly totals in a multi-tab layout (Declaracao, Importar, Submeter, Graficos, Historico). The accountant Adelia reported:

- "A APP nao esta a ir muito ao encontro do que precisamos, parece-me ter coisas a mais, esta confusa."
- She needs monthly values per category (matching seg-social.pt form) to copy-paste into SS Directa.
- Current page shows quarterly totals only — no monthly breakdown.

A wizard was considered but rejected: 4 steps x 242 clients = ~968 clicks/quarter. The accountant already knows the SS process — she needs speed, not guidance.

## Design

### Architecture

The calculation layer is untouched. Changes are purely presentational:

- **Keep as-is:** `useSocialSecurity.tsx`, `socialSecurityRevenue.ts`, `ssCoefficients.ts`, `getQuarterDateRange()`, `getSalesInvoiceRevenueAmount()`, `getSalesInvoiceRevenueCategory()`
- **Modify:** `src/pages/SocialSecurity.tsx` — replace Declaracao tab content with 3-section layout
- **Create:** `src/components/social-security/SSRevenueBreakdown.tsx` — monthly breakdown table
- **Modify:** `src/hooks/useSocialSecurity.tsx` — add `monthlyBreakdown` to the `totals` useMemo (group sales_invoices by month + category)

### Section 1 — Client Status (1 line)

A single-line status badge at the top:

- `Isento — 1o ano de actividade` (green badge, no further sections shown)
- `Isento — Acumulacao TCO, rendimento < 4xIAS` (green badge)
- `Contribuinte activo — 21.4%` (neutral badge, show sections 2+3)
- `Contribuinte activo — 25.2% (ENI)` (neutral badge)

Data source: `calculatedContribution.isExempt`, `calculatedContribution.exemptReason`, profile `ss_contribution_rate`.

If exempt: show the badge + reason + "Alterar nas definicoes" link. Hide sections 2 and 3.
If active: show all 3 sections.

### Section 2 — Monthly Revenue Breakdown (new)

A compact table that mirrors the seg-social.pt declaration form:

```
Rendimentos do trimestre (valores sem IVA — base tributavel)

| Categoria              | {month1} | {month2} | {month3} | Total   |
|------------------------|----------|----------|----------|---------|
| Prestacao de servicos  | 1,890.00 | 2,110.00 | 1,750.00 | 5,750.00|
| Vendas                 |     0.00 |     0.00 |     0.00 |     0.00|
| ...                    |          |          |          |         |
| TOTAL                  | 1,890.00 | 2,110.00 | 1,750.00 | 5,750.00|
```

**Data source:** Existing `salesInvoices` array from `useSocialSecurity`. Currently aggregated as quarterly total in `totals.byCategory`. New: group by `document_date` month before aggregating by category.

**Implementation detail — `useSocialSecurity.tsx` change:**

Add a `monthlyBreakdown` field to the existing `totals` useMemo:

```typescript
// Inside the existing totals useMemo, after the current byCategory logic:
const monthlyBreakdown: Record<string, Record<string, number>> = {};
const [qYear, qNum] = quarter.split('-Q');
const quarterStartMonth = (Number(qNum) - 1) * 3; // 0-indexed

for (let m = 0; m < 3; m++) {
  const monthKey = `${qYear}-${String(quarterStartMonth + m + 1).padStart(2, '0')}`;
  monthlyBreakdown[monthKey] = {};
}

salesInvoices.forEach(inv => {
  const amount = getSalesInvoiceRevenueAmount(inv);
  const category = getSalesInvoiceRevenueCategory(inv);
  const monthKey = (inv.document_date || '').slice(0, 7); // "YYYY-MM"
  if (monthlyBreakdown[monthKey]) {
    monthlyBreakdown[monthKey][category] =
      (monthlyBreakdown[monthKey][category] || 0) + amount;
  }
});

// Also include manual revenue entries
revenueEntries.forEach(entry => {
  // Manual entries are quarterly — distribute evenly across 3 months
  const perMonth = Number(entry.amount) / 3;
  Object.keys(monthlyBreakdown).forEach(monthKey => {
    monthlyBreakdown[monthKey][entry.category] =
      (monthlyBreakdown[monthKey][entry.category] || 0) + perMonth;
  });
});
```

Return `monthlyBreakdown` alongside existing `byCategory`, `total`, `relevantIncome`, etc.

**Categories shown:** Only categories with non-zero values, plus the client's detected CAE category (even if zero, so it's visible for manual entry). Categories from `SS_REVENUE_CATEGORIES` in `ssCoefficients.ts`.

**Editable:** Each cell is editable inline (click to edit, blur to save). Edits create/update manual `ss_revenue_entries` for that month+category. This handles cases where sales_invoices are incomplete.

**Note below table:** "Valores sem IVA (base tributavel) — calculados automaticamente das facturas de vendas validadas."

### Section 3 — Calculation + Action

Compact calculation summary + action buttons:

```
Rendimento relevante: 4,025.00 EUR (coeficiente 70%)
Base de incidencia: 3,018.75 EUR
Variacao: [-25%] [0%] [+25%]    (toggle buttons, default -25%)
Taxa: 21.4%
Contribuicao mensal: 282.96 EUR

[Copy para SS Directa]  [Abrir SS Directa]  [Marcar submetido]
```

**"Copiar para SS Directa" button** — formats the monthly values in a pasteable format:

```
Declaracao Trimestral SS — {quarter_label}
Cliente: {name} (NIF {nif})

Prestacao de servicos:
  {month1_name}: {amount} EUR
  {month2_name}: {amount} EUR
  {month3_name}: {amount} EUR

Vendas:
  {month1_name}: {amount} EUR
  ...

Variacao: -25%
Contribuicao mensal prevista: {amount} EUR
```

**"Abrir SS Directa"** — opens `https://app.seg-social.pt/` (already exists at line 341).

**"Marcar submetido"** — saves declaration with status `submitted` and locks the quarter (already exists: `handleSaveDeclaration('submitted')`).

### Tab Structure (simplified)

Current 5 tabs → 3 tabs:

| Tab | Content |
|-----|---------|
| **Declaracao** | Sections 1+2+3 above (the main view) |
| **Importar** | RevenueImporter (Excel upload for recibos verdes) — unchanged |
| **Historico** | Past declarations + charts — merge current Graficos + Historico tabs |

Remove "Submeter" tab (merged into Section 3) and "Graficos" tab (merged into Historico).

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useSocialSecurity.tsx` | Add `monthlyBreakdown` to `totals` useMemo (~25 lines) |
| `src/pages/SocialSecurity.tsx` | Restructure Declaracao tab: 3 sections, 3 tabs instead of 5 |
| `src/components/social-security/SSRevenueBreakdown.tsx` | New: monthly breakdown table component |
| `src/components/social-security/SSCalculationSummary.tsx` | New: compact calculation + action buttons |
| `src/components/social-security/SubmissionGuide.tsx` | Remove (merged into Section 3) |

## Files NOT Changed

- `src/hooks/useSocialSecurity.tsx` calculation logic (rates, exemptions, coefficients)
- `src/lib/socialSecurityRevenue.ts` (revenue amount/category functions)
- `src/lib/ssCoefficients.ts` (coefficients and categories)
- `src/components/social-security/RevenueImporter.tsx`
- `src/components/social-security/RevenueCharts.tsx`
- `src/components/social-security/PortalLinks.tsx`

## Testing

- Existing 43 socialSecurity tests + 31 ssCoefficients tests remain unchanged (logic untouched)
- Add test for `monthlyBreakdown` grouping: given 6 sales_invoices across 3 months and 2 categories, verify correct month+category aggregation
- Add test for copy-to-clipboard format: verify monthly values appear in correct order

## Success Criteria

1. Accountant sees monthly values per category without clicking through steps
2. Values match what seg-social.pt expects (base tributavel, no IVA)
3. "Copiar para SS Directa" produces pasteable text with monthly breakdown
4. Processing 1 client takes 1-2 clicks (verify → copy → mark submitted)
5. Page loads without regression on existing 905 tests
