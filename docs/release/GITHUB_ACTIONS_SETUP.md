# GitHub Actions — Required Secrets

The repository has two automation workflows under `.github/workflows/`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `deploy-supabase.yml` | Push to `main` when `supabase/**` changes, or manual dispatch | Apply migrations, deploy changed edge functions |
| `force-sync-client.yml` | Manual dispatch with `client_id` + `direction` inputs | Invoke `sync-efatura` for a single client outside the scheduled window |
| `ci.yml` | All pushes / PRs | Lint + Vitest + build (no deploy) |

Configure these secrets once at **Settings → Secrets and variables → Actions → New repository secret**.

## For `deploy-supabase.yml`

| Secret | Where to find it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens — create a new personal access token |
| `SUPABASE_DB_PASSWORD` | Supabase dashboard → Project settings → Database → Connection info → `Database password` (reveal or reset if forgotten) |
| `SUPABASE_PROJECT_REF` | Supabase dashboard → Project settings → General → `Project Reference ID` (short slug like `dmprkdvkzzjtixlatnlx`) |

## For `force-sync-client.yml`

| Secret | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Same as the `VITE_SUPABASE_URL` in `.env`. Typically `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase dashboard → Project settings → API → `service_role` key. Treat like a password. |

## First-time verification

1. Add all 5 secrets above.
2. Go to **Actions → Deploy Supabase → Run workflow** (manual dispatch, `main` branch, leave inputs default).
3. Confirm the run shows `Applied migrations` and `Deployed sync-efatura`. Failure on missing secrets will print `::error::Missing required secrets: <list>` as the first actionable step.
4. Then open **Actions → Force AT sync for client → Run workflow** and pass `client_id = 5a994a12-8364-4320-ac35-e93f81edcf10` (Bilal) to verify the sync path end-to-end.

## Cost envelope

- Repository is public → GitHub Actions minutes are **unlimited and free**.
- Supabase CLI deploys are admin API calls → **no Supabase-side charge**; only regular invocations of the deployed functions count against your project's quota.
- Typical workflow run: ~3–5 minutes for a deploy, ~1–2 minutes for a force sync.

## Rotating or revoking

- To invalidate a token: delete it under **Account → Access Tokens** on Supabase, then rotate the secret in GitHub.
- To disable a workflow temporarily: rename it to `.yml.disabled` or remove the trigger section.

## Troubleshooting

- **`permission denied` on `db push`** → the DB password is wrong or the role on the access token is insufficient.
- **`project not linked`** → the `supabase link` step failed; confirm `SUPABASE_PROJECT_REF` matches your project exactly.
- **`function not found`** during deploy → the detected change set includes a function that was renamed or deleted. Trigger manual dispatch with `only_functions` set to the real names.
