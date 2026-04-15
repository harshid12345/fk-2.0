---
name: Viewing reminder and cancellation cascade
description: Automated 24h/2h reminders with cascading slot reassignment to next-best applicants
type: feature
---
## Flow
1. **24h reminder**: Cron job (telegram-reminder) sends "Are you still coming? YES/NO" 24h before viewing
2. **No response / NO**: After 10 min timeout or explicit NO → cancel booking, offer slot to top 3 applicants simultaneously
3. **Cascade**: First YES wins. Others get "slot filled" message. If all decline/timeout → notify landlord
4. **2h reminder**: Passive "see you there" reminder 2h before
5. **Late cancel** (within 3h of viewing): Same cascade but 5 min timeout

## Score penalty
- Each cancellation or no-response: -0.5 points (stored as -5 in match_score which is x10)
- 2+ total issues: "Reliability warning" flag visible on landlord dashboard

## Database
- `viewing_bookings` columns: reminder_24h_sent_at, reminder_24h_response, reminder_2h_sent_at, reminder_2h_response, cascade_state, cascade_data
- `applicants` columns: cancellation_count, no_response_count

## Cron
- `telegram-reminder` edge function runs every minute via pg_cron
- Handles: sending reminders, checking timeouts, notifying landlord on cascade failure
