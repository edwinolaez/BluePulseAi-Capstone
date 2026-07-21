#!/usr/bin/env bash
# OWASP A09 verification — confirm 401 attempts are logged in Railway
#
# Usage:
#   RAILWAY_API_URL=https://your-railway-url.railway.app bash scripts/test_a09.sh
#
# After running, go to Railway dashboard → jasper-api service → Logs tab
# and confirm you see a 401 entry for the request below.

BASE_URL="${RAILWAY_API_URL:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "ERROR: Set RAILWAY_API_URL before running."
  echo "  export RAILWAY_API_URL=https://your-service.railway.app"
  echo "  bash scripts/test_a09.sh"
  exit 1
fi

echo "Sending deliberate bad-key request to $BASE_URL/health ..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-API-Key: INVALID-KEY-A09-TEST" \
  "$BASE_URL/health")

echo "Response status: $HTTP_STATUS"

if [[ "$HTTP_STATUS" == "401" ]]; then
  echo "PASS — got 401. Now check Railway Logs tab to confirm the entry appears."
  echo "  Look for: POST/GET /health | 401 | X-API-Key: INVALID-KEY-A09-TEST"
else
  echo "UNEXPECTED STATUS $HTTP_STATUS — health endpoint may not require auth, try /api/v1/layers/ATH-001"
  HTTP_STATUS2=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-API-Key: INVALID-KEY-A09-TEST" \
    "$BASE_URL/api/v1/layers/ATH-001")
  echo "  /api/v1/layers/ATH-001 status: $HTTP_STATUS2"
fi

echo ""
echo "Next step: Railway dashboard → jasper-api → Logs tab → search 'INVALID-KEY-A09-TEST' or '401'"
echo "Mark A09 checkbox in docs/owasp-mapping.md once confirmed."
