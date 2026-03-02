#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${1:-dmprkdvkzzjtixlatnlx}"
SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"

if [[ -z "${SUPABASE_URL}" && -f ".env" ]]; then
  SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' .env | head -n1 | cut -d= -f2- | tr -d '"')"
fi

if [[ -z "${SUPABASE_URL}" ]]; then
  echo "ERROR: Missing SUPABASE_URL/VITE_SUPABASE_URL"
  exit 1
fi

echo "Project: ${PROJECT_REF}"
echo "Supabase URL: ${SUPABASE_URL}"
echo

TMP_JSON="$(mktemp)"
supabase secrets list --project-ref "${PROJECT_REF}" --output json 2>/dev/null | sed -n '/^[\[{]/,$p' > "${TMP_JSON}"

python3 - "${TMP_JSON}" <<'PY'
import json,sys
rows=json.load(open(sys.argv[1]))
names={r["name"] for r in rows}
required=[
  "AT_CONNECTOR_URL",
  "AT_CONNECTOR_TOKEN",
  "AT_ENCRYPTION_KEY",
  "APP_ORIGIN",
]
optional=["AT_CONNECTOR_CA_CERT","AT_CONNECTOR_CA_CERT_B64"]
print("== Secret Presence ==")
for k in required:
    print(f"{k}: {'OK' if k in names else 'MISSING'}")
print("-- optional --")
for k in optional:
    print(f"{k}: {'OK' if k in names else 'missing'}")
PY

echo
echo "== Last 24h AT sync summary =="

API_KEYS_JSON="$(mktemp)"
supabase projects api-keys --project-ref "${PROJECT_REF}" --output json 2>/dev/null | sed -n '/^[\[{]/,$p' > "${API_KEYS_JSON}"
SERVICE_KEY="$(python3 - "${API_KEYS_JSON}" <<'PY'
import json,sys
rows=json.load(open(sys.argv[1]))
print(next(x["api_key"] for x in rows if x["name"]=="service_role"))
PY
)"

SINCE="$(python3 - <<'PY'
from datetime import datetime,timedelta,timezone
print((datetime.now(timezone.utc)-timedelta(days=1)).isoformat().replace('+00:00','Z'))
PY
)"

CURL_URL="${SUPABASE_URL%/}/rest/v1/at_sync_history?select=sync_method,status,reason_code,created_at&created_at=gte.${SINCE}&order=created_at.desc&limit=2000"

AT_ROWS_JSON="$(mktemp)"
curl -sS "${CURL_URL}" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" > "${AT_ROWS_JSON}"

python3 - "${AT_ROWS_JSON}" <<'PY'
import json,sys,collections
rows=json.load(open(sys.argv[1]))
print(f"rows_24h: {len(rows)}")
print("sync_method:", dict(collections.Counter(r.get("sync_method") for r in rows)))
print("status:", dict(collections.Counter(r.get("status") for r in rows)))
print("top_reason_codes:", collections.Counter(r.get("reason_code") for r in rows).most_common(8))
PY

echo
echo "Done."
