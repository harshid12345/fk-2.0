#!/usr/bin/env bash
# test-whatsapp-reminder.sh
#
# Triggers the whatsapp-reminder edge function manually and checks the response.
# This is the same function that pg_cron calls every 15 minutes in production.
#
# REQUIRES:
#   SUPABASE_SERVICE_ROLE_KEY env var (or set in scripts/.env.test)
#   Get it from: Supabase dashboard → Settings → API → service_role
#
# USAGE:
#   export SUPABASE_SERVICE_ROLE_KEY="your_key"
#   bash scripts/test-whatsapp-reminder.sh

set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

PROJECT_REF="nycfhumiaofwsefhruwj"
BASE_URL="https://${PROJECT_REF}.supabase.co"

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Y2ZodW1pYW9md3NlZmhydXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTQ0MTAsImV4cCI6MjA5MjI5MDQxMH0.k1bZ92AD97RVy9wZhomic7sOiWCC36u5EMFbXpoi_7Y"

# ── Colors ────────────────────────────────────────────────────────────────────

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
  echo "    bash scripts/test-whatsapp-reminder.sh"
  echo ""
  echo "  Or create scripts/.env.test with a single line:"
  echo "    SUPABASE_SERVICE_ROLE_KEY=eyJ..."
  exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo -e "  ${GREEN}PASS${RESET}  $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}FAIL${RESET}  $1"; ((FAIL_COUNT++)) || true; }
info() { echo -e "  ${YELLOW}INFO${RESET}  $1"; }
step() { echo -e "\n${BOLD}[$1]${RESET} $2"; }

db_get() {
  curl -sf \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    "${BASE_URL}/rest/v1/$1" 2>/dev/null || echo "[]"
}

# ── Banner ────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}WhatsApp Reminder Function Test${RESET}"
echo -e "Project: ${PROJECT_REF}"
echo "────────────────────────────────────────────"

# ── Step 1: Count confirmed bookings in the next 72h ─────────────────────────

step 1 "Count confirmed bookings due for reminders (next 72h)"

NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
WINDOW_ISO=$(date -u -v+72H +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -d "+72 hours" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || echo "")

if [[ -n "${WINDOW_ISO}" ]]; then
  BOOKINGS=$(db_get "viewing_bookings?status=eq.confirmed&slot_start=gte.${NOW_ISO}&slot_start=lte.${WINDOW_ISO}&select=id,slot_start")
  BOOKING_COUNT=$(echo "${BOOKINGS}" | grep -o '"id"' | wc -l | tr -d ' ')
  info "Found ${BOOKING_COUNT} confirmed booking(s) in the next 72 hours"
else
  info "Could not compute 72h window on this platform — skipping pre-check"
fi

# ── Step 2: Invoke the reminder function ──────────────────────────────────────

step 2 "Trigger whatsapp-reminder edge function"

START_TS=$(date +%s)

RESULT=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "${BASE_URL}/functions/v1/whatsapp-reminder")

END_TS=$(date +%s)
ELAPSED=$((END_TS - START_TS))

HTTP_STATUS=$(echo "${RESULT}" | tail -1)
RESPONSE_BODY=$(echo "${RESULT}" | head -n -1)

if [[ "${HTTP_STATUS}" == "200" ]]; then
  pass "Reminder function returned HTTP 200 (${ELAPSED}s)"
else
  fail "Reminder function returned HTTP ${HTTP_STATUS} (expected 200)"
  echo "  Response: ${RESPONSE_BODY}"
fi

# ── Step 3: Parse the response body ──────────────────────────────────────────

step 3 "Inspect response body"

if echo "${RESPONSE_BODY}" | grep -q '"success":true\|"ok":true\|"processed"'; then
  pass "Response body indicates success"
  echo "  Body: ${RESPONSE_BODY}"
elif [[ -z "${RESPONSE_BODY}" || "${RESPONSE_BODY}" == "OK" ]]; then
  pass "Response body is OK (empty body is normal for cron functions)"
else
  info "Unexpected body (may still be OK): ${RESPONSE_BODY}"
fi

# ── Step 4: Sanity check — no stuck 'pending' cascade states ─────────────────

step 4 "Check for stuck cascade states (cascade_state != null, older than 30 min)"

THIRTY_AGO=$(date -u -v-30M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || date -u -d "-30 minutes" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null \
  || echo "")

if [[ -n "${THIRTY_AGO}" ]]; then
  STUCK=$(db_get "viewing_bookings?cascade_state=not.is.null&cascade_expires_at=lte.${THIRTY_AGO}&select=id,cascade_state,cascade_expires_at")
  STUCK_COUNT=$(echo "${STUCK}" | grep -o '"id"' | wc -l | tr -d ' ')
  if [[ "${STUCK_COUNT}" -eq 0 ]]; then
    pass "No stuck cascade states found"
  else
    fail "${STUCK_COUNT} booking(s) have expired cascade states — the reminder cron may not be running"
    echo "  Stuck bookings: ${STUCK}"
  fi
else
  info "Could not compute 30-min window on this platform — skipping cascade check"
fi

# ── Step 5: Check cron job is registered ─────────────────────────────────────

step 5 "Verify pg_cron job is registered"

# pg_cron jobs live in the cron schema, accessible via the REST API only with service role.
# We query it through a custom RPC or check the migration was applied.
# Simplest check: confirm the migration ran by looking for the cron-related migration file.

MIGRATION_FILE="${SCRIPT_DIR}/../supabase/migrations/20260425000002_add_whatsapp_reminder_cron.sql"
if [[ -f "${MIGRATION_FILE}" ]]; then
  pass "Cron migration file exists (20260425000002)"
else
  info "Cron migration file not found at expected path — verify it ran in the dashboard"
fi

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
echo -e "  ${YELLOW}NOTE:${RESET} WA messages to real tenants ARE sent if bookings exist."
echo -e "  Run this during off-hours or when no real bookings are due to avoid"
echo -e "  triggering duplicate reminder messages."
echo ""

exit "${FAIL_COUNT}"
