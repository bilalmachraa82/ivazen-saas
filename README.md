# IVAzen

IVAzen is an internal accounting operations platform for Portuguese fiscal workflows. The current delivery track focuses on accountant-first reliability, deterministic import flows, and auditability across purchases, sales, reconciliation, VAT, Social Security, and Modelo 10.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Supabase

## Local development

```sh
npm install
npm run dev
```

## Quality gates

```sh
npm run build
npm test
npm run lint
npm run verify:release
```

## Release model

- `main` stays stable until the release branch is audited and approved.
- Release work happens in `release/*`.
- Feature workstreams branch from `origin/main` and merge into the release branch first.
- Only audited release branches can merge into `main`.

## Release documentation

- [Release Notes](docs/release/RELEASE_NOTES_IVAZEN_FINAL_2026-03.md)
- [Accountant UAT Checklist](docs/release/UAT_CHECKLIST_ACCOUNTANT.md)
- [Known Limitations](docs/release/KNOWN_LIMITATIONS.md)
- [Rollback Runbook](docs/release/ROLLBACK_RUNBOOK.md)
- [Deploy Runbook](docs/release/DEPLOY_RUNBOOK.md)
- [Accountant Feedback Matrix](docs/release/ACCOUNTANT_FEEDBACK_MATRIX_2026-03.md)

## Deployment

Frontend deployment is SPA-based and uses [vercel.json](vercel.json). Supabase migrations and edge functions must be rolled out using the release runbooks above.
