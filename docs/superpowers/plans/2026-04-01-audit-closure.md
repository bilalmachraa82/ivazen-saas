# IVAzen Audit Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the final repository audit gaps in landing copy, secret-hygiene scanning, and invoice search behavior.

**Architecture:** Keep the fix set narrow. Add small regression tests first, then make the smallest possible code edits in the existing files. For invoice search, move the decision logic into pure helper functions so the hook behavior is testable without changing the page contract.

**Tech Stack:** React, TypeScript, Vitest, Vite, Supabase client helpers

---

### Task 1: Add regression tests for the remaining audit gaps

**Files:**
- Create: `src/lib/__tests__/auditClosure.test.ts`
- Test: `src/lib/__tests__/auditClosure.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('keeps landing copy free from hard measured claims', () => {
  // assert banned phrases are absent
});

it('does not keep the JWT prefix literal in tracked test source', () => {
  // assert exact literal is absent from secretHygiene.test.ts
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/auditClosure.test.ts`
Expected: FAIL because the current landing copy and secret-hygiene test still contain the audited strings.

### Task 2: Add invoice-search helper tests

**Files:**
- Create: `src/lib/__tests__/invoiceSearch.test.ts`
- Create: `src/lib/invoiceSearch.ts`
- Modify: `src/hooks/useInvoices.tsx`
- Test: `src/lib/__tests__/invoiceSearch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('escapes ilike wildcards', () => {
  expect(escapeInvoiceSearchTerm('a%b_c\\\\d')).toBe('a\\\\%b\\\\_c\\\\\\\\d');
});

it('keeps 2+ char searches on the server path', () => {
  expect(applyClientInvoiceSearchFallback(rows, 'mario')).toEqual(rows);
});

it('keeps 1-char fallback accent-insensitive', () => {
  expect(applyClientInvoiceSearchFallback(rows, 'm')).toEqual([rows[0]]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/__tests__/invoiceSearch.test.ts`
Expected: FAIL because the helper does not exist yet.

### Task 3: Implement the minimal production changes

**Files:**
- Modify: `src/pages/Landing.tsx`
- Modify: `src/lib/__tests__/secretHygiene.test.ts`
- Create: `src/lib/invoiceSearch.ts`
- Modify: `src/hooks/useInvoices.tsx`

- [ ] **Step 1: Update landing copy**

Change hard metrics and hard outcome statements to estimate-safe wording while preserving layout.

- [ ] **Step 2: Remove the literal JWT prefix from source**

Build the regex from string segments instead of embedding the exact token prefix.

- [ ] **Step 3: Implement invoice-search helpers**

Add pure helpers for escaping and short-search fallback, then use them from the hook.

- [ ] **Step 4: Keep the hook on the server path for 2+ char searches**

Use the helper so 2+ character searches return server-filtered data directly, while 1-character searches still get local accent-insensitive fallback on the fetched set.

### Task 4: Verify and re-audit

**Files:**
- Test: `src/lib/__tests__/auditClosure.test.ts`
- Test: `src/lib/__tests__/invoiceSearch.test.ts`

- [ ] **Step 1: Run targeted tests**

Run: `npm test -- --run src/lib/__tests__/auditClosure.test.ts src/lib/__tests__/invoiceSearch.test.ts`
Expected: PASS

- [ ] **Step 2: Run full verification**

Run: `npm run lint`
Expected: PASS

Run: `npm test -- --run`
Expected: PASS

Run: `npm run build`
Expected: PASS with code-split chunks and generated `dist/sw.js`
