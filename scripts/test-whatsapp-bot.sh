#!/usr/bin/env bash
# test-whatsapp-bot.sh
#
# Tests the full WhatsApp screening flow end to end via curl.
# No real phone number needed — uses a fake test phone that never
# receives actual messages (WA API sends will fail silently).
#
# REQUIRES:
#   SUPABASE_SERVICE_ROLE_KEY env var (or set in scripts/.env.test)
#   Get it from: Supabase dashboard → Settings → API → service_role
#
# USAGE:
#   export SUPABASE_SERVICE_ROLE_KEY="your_key"
#   bash scripts/test-whatsapp-bot.sh

set -uo pipefail

# ── Config ───────────────────────────────────────────────────────────────────

PROJECT_REF="nycfhumiaofwsefhruwj"
BASE_URL="https://${PROJECT_REF}.supabase.co"

# Anon key is safe to hardcode — it is already public in the frontend bundle
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Y2ZodW1pYW9md3NlZmhydXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTQ0MTAsImV4cCI6MjA5MjI5MDQxMH0.k1bZ92AD97RVy9wZhomic7sOiWCC36u5EMFbXpoi_7Y"

# Fake phone — uses a valid E.164 format but is not a real WA account.
# The screener will create the applicant; the WA message back will fail
# at the Meta API layer, which the function ignores (returns 200 anyway).
TEST_PHONE="31699000001"

# ── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Load optional .env.test ───────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.env.test" ]]; then
  # shellcheck disable=SC1091
  set -a; source "${SCRIPT_DIR}/.env.test"; set +a
fi

# ── Check required secrets ────────────────────────────────────────────────────

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo -e "${RED}ERROR:${RESET} SUPABASE_SERVICE_ROLE_KEY is not set."
  echo ""
  echo "  Get it from: Supabase dashboard → Settings → API → service_role"
  echo ""
  echo "  Then run:"
  echo "    export SUPABASE_SERVICE_ROLE_KEY='eyJ...'"
  echo "    bash scripts/test-whatsapp-bot.sh"
  echo ""
  echo "  Or create scripts/.env.test with a single line:"
  echo "    SUPABASE_SERVICE_ROLE_KEY=eyJ..."
  exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0

pass()  { echo -e "  ${GREEN}PASS${RESET}  $1"; ((PASS_COUNT++)) || true; }
fail()  { echo -e "  ${RED}FAIL${RESET}  $1"; ((FAIL_COUNT++)) || true; }
info()  { echo -e "  ${YELLOW}INFO${RESET}  $1"; }
step()  { echo -e "\n${BOLD}[$1]${RESET} $2"; }

# Makes a DB REST call with the service role key.
# Usage: db_get "table?query"  → prints response body
db_get() {
  curl -sf \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    "${BASE_URL}/rest/v1/$1" 2>/dev/null || echo "[]"
}

db_delete() {
  curl -sf -X DELETE \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    "${BASE_URL}/rest/v1/$1" >/dev/null 2>&1 || true
}

# Calls an edge function with the anon key.
# Usage: fn_call "function-name" '{"json":"body"}'
# Outputs: BODY\nHTTP_STATUS on two lines
fn_call() {
  local fn="$1" body="$2"
  curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "${body}" \
    "${BASE_URL}/functions/v1/${fn}"
}

# Parse the last line as HTTP status; everything before it is the body.
http_status() { echo "$1" | tail -1; }
http_body()   { echo "$1" | head -n -1; }

# ── Banner ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}WhatsApp Bot Integration Test${RESET}"
echo -e "Project: ${PROJECT_REF}"
echo -e "Test phone: ${TEST_PHONE}"
echo "────────────────────────────────────────────"

# ── Step 1: Get a real seeking property ──────────────────────────────────────

step 1 "Fetch a 'seeking' property from the database"

PROP_RESPONSE=$(db_get "landlord_properties?select=id,address&status=eq.seeking&limit=1")
PROPERTY_ID=$(echo "${PROP_RESPONSE}"   | grep -o '"id":"[^"]*"'      | head -1 | cut -d'"' -f4)
PROPERTY_ADDR=$(echo "${PROP_RESPONSE}" | grep -o '"address":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -z "${PROPERTY_ID}" ]]; then
  fail "No property with status='seeking' found. Create one in the app first."
  echo ""
  echo "  Raw DB response: ${PROP_RESPONSE}"
  exit 1
fi

pass "Property: \"${PROPERTY_ADDR}\" (${PROPERTY_ID})"

# ── Step 2: Clean up stale test data ─────────────────────────────────────────

step 2 "Clean up any leftover test applicant from a previous run"

db_delete "applicants?whatsapp_phone=eq.${TEST_PHONE}"
info "Done (silently skips if nothing existed)"

# ── Step 3: Simulate 'start {propertyId}' text message to screener ───────────

step 3 "Send 'start ${PROPERTY_ID}' to whatsapp-screener (simulated Meta webhook)"

SCREENER_PAYLOAD=$(cat <<EOF
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "${TEST_PHONE}",
          "type": "text",
          "text": { "body": "start ${PROPERTY_ID}" }
        }]
      }
    }]
  }]
}
EOF
)

SCREENER_RESULT=$(fn_call "whatsapp-screener" "${SCREENER_PAYLOAD}")
SCREENER_HTTP=$(http_status "${SCREENER_RESULT}")
SCREENER_BODY=$(http_body  "${SCREENER_RESULT}")

if [[ "${SCREENER_HTTP}" == "200" ]]; then
  pass "Screener returned HTTP 200"
else
  fail "Screener returned HTTP ${SCREENER_HTTP} (expected 200) — body: ${SCREENER_BODY}"
fi

# ── Step 4: Verify applicant row was created ──────────────────────────────────

step 4 "Check that a new applicant row exists in the database"

# Give the edge function a moment to finish its DB write
sleep 2

APP_RESPONSE=$(db_get "applicants?whatsapp_phone=eq.${TEST_PHONE}&select=id,stage,property_id")
APPLICANT_ID=$(echo    "${APP_RESPONSE}" | grep -o '"id":"[^"]*"'      | head -1 | cut -d'"' -f4)
APPLICANT_STAGE=$(echo "${APP_RESPONSE}" | grep -o '"stage":"[^"]*"'   | head -1 | cut -d'"' -f4)
APP_PROP_ID=$(echo     "${APP_RESPONSE}" | grep -o '"property_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [[ -n "${APPLICANT_ID}" ]]; then
  pass "Applicant created (id=${APPLICANT_ID})"
else
  fail "Applicant NOT found in DB after screener call"
  echo "  DB response: ${APP_RESPONSE}"
  # Can not continue without an applicant ID
  echo ""
  echo -e "${BOLD}────────────────────────────────────────────${RESET}"
  echo -e "${RED}${BOLD}Test aborted — ${FAIL_COUNT} failure(s), ${PASS_COUNT} pass(es)${RESET}"
  exit 1
fi

if [[ "${APPLICANT_STAGE}" == "lang_select" ]]; then
  pass "Stage is 'lang_select' (correct initial state)"
else
  fail "Stage is '${APPLICANT_STAGE}' (expected 'lang_select')"
fi

if [[ "${APP_PROP_ID}" == "${PROPERTY_ID}" ]]; then
  pass "Applicant linked to correct property"
else
  fail "Applicant property_id '${APP_PROP_ID}' does not match '${PROPERTY_ID}'"
fi

# ── Step 5: Simulate landlord approving the applicant ────────────────────────

step 5 "Call whatsapp-notify-tenant with action=approve"

APPROVE_PAYLOAD="{\"applicantId\": \"${APPLICANT_ID}\", \"action\": \"approve\"}"
APPROVE_RESULT=$(fn_call "whatsapp-notify-tenant" "${APPROVE_PAYLOAD}")
APPROVE_HTTP=$(http_status "${APPROVE_RESULT}")
APPROVE_BODY=$(http_body  "${APPROVE_RESULT}")

if [[ "${APPROVE_HTTP}" == "200" ]]; then
  pass "Notify-tenant returned HTTP 200"
else
  fail "Notify-tenant returned HTTP ${APPROVE_HTTP} — body: ${APPROVE_BODY}"
fi

if echo "${APPROVE_BODY}" | grep -q '"success":true'; then
  pass "Response body: success=true"
else
  fail "Response body missing success=true — got: ${APPROVE_BODY}"
fi

# ── Step 6: Verify DB state after approve ─────────────────────────────────────

step 6 "Confirm DB reflects the approved state"

sleep 1

UPDATED=$(db_get "applicants?id=eq.${APPLICANT_ID}&select=stage,pending_viewing_slots")
FINAL_STAGE=$(echo   "${UPDATED}" | grep -o '"stage":"[^"]*"' | head -1 | cut -d'"' -f4)
SLOTS_VALUE=$(echo   "${UPDATED}" | grep -o '"pending_viewing_slots":"[^"]*"' | head -1 || true)

if [[ "${FINAL_STAGE}" == "approved" ]]; then
  pass "Applicant stage updated to 'approved'"
else
  fail "Applicant stage is '${FINAL_STAGE}' (expected 'approved')"
fi

if [[ -n "${SLOTS_VALUE}" && "${SLOTS_VALUE}" != *'null'* ]]; then
  pass "pending_viewing_slots set — viewing times were sent to the tenant"
else
  info "pending_viewing_slots is null — landlord has no viewing schedule set up (not a bug)"
fi

# ── Step 7: Verify webhook verification endpoint (GET) ───────────────────────

step 7 "Test webhook verification (GET with hub.challenge)"

VERIFY_TOKEN="fairkamer2026"
CHALLENGE="test_challenge_$(date +%s)"

VERIFY_RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
  "${BASE_URL}/functions/v1/whatsapp-screener?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${CHALLENGE}")

if [[ "${VERIFY_RESULT}" == "200" ]]; then
  pass "Webhook verification GET returned HTTP 200"
else
  fail "Webhook verification GET returned HTTP ${VERIFY_RESULT} (expected 200)"
fi

# ── Step 8: Cleanup ───────────────────────────────────────────────────────────

step 8 "Delete test applicant"

db_delete "applicants?whatsapp_phone=eq.${TEST_PHONE}"
info "Test applicant deleted"

# ── Report ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}════════════════════════════════════════════${RESET}"
if [[ "${FAIL_COUNT}" -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  All ${PASS_COUNT} tests passed${RESET}"
else
  echo -e "${RED}${BOLD}  ${FAIL_COUNT} test(s) failed${RESET}  (${PASS_COUNT} passed)"
fi
echo -e "${BOLD}════════════════════════════════════════════${RESET}"
echo ""

exit "${FAIL_COUNT}"
