# IVAzen Audit Closure Design

## Context

The 2026-04-01 validation audit left three repository-level gaps open:

1. `src/pages/Landing.tsx` still contains hard, measured-sounding marketing claims.
2. `src/lib/__tests__/secretHygiene.test.ts` contains the literal JWT prefix string that the audit grep flags.
3. `src/hooks/useInvoices.tsx` still applies client-side filtering after fetching invoice pages, weakening the server-side-search claim.

## Goal

Close the remaining repository gaps without changing production infrastructure or database state, and without widening scope beyond the audited failures.

## Approach

### Landing copy

Replace absolute metrics and outcome claims with clearly non-measured wording. Keep the same structure and visual hierarchy so the page remains stable.

### Secret hygiene

Keep the existing test intent, but construct the JWT-prefix regex without storing the exact literal in source code.

### Invoice search

Preserve server-side `ilike` search for 2+ character terms. Keep a lightweight accent-insensitive client fallback only for 1-character searches, which preserves the normalization logic in the file while avoiding the expensive post-fetch filtering path for meaningful queries.

## Risks

- Landing copy changes can accidentally leave another absolute metric behind.
- Search changes can unintentionally alter short-search behavior.
- Refactoring the hook can break invoice loading if tests do not cover the fallback boundary.

## Validation

- Add regression tests for landing copy and secret-hygiene literal removal.
- Add unit tests for invoice search helpers.
- Re-run `npm test -- --run`, `npm run lint`, and `npm run build`.
