-- Migration: Add SMS tokens for tenant-facing web forms
-- Replaces WhatsApp bot flow with hosted web forms + SMS notifications

-- 1. Add application_token and concierge_token to landlord_properties
ALTER TABLE landlord_properties
  ADD COLUMN IF NOT EXISTS application_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS concierge_token    TEXT UNIQUE DEFAULT gen_random_uuid()::text;

-- Backfill tokens for existing rows that have NULL (shouldn't happen due to DEFAULT, but safe)
UPDATE landlord_properties
  SET application_token = gen_random_uuid()::text
  WHERE application_token IS NULL;

UPDATE landlord_properties
  SET concierge_token = gen_random_uuid()::text
  WHERE concierge_token IS NULL;

-- 2. Add schedule_token and form_progress to applicants
ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS schedule_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS form_progress  JSONB DEFAULT '{}'::jsonb;

UPDATE applicants
  SET schedule_token = gen_random_uuid()::text
  WHERE schedule_token IS NULL;

-- 3. RLS: allow anonymous reads on landlord_properties using application_token
-- Tenants can read minimal property info to display on the apply page
CREATE POLICY IF NOT EXISTS "anon_read_by_application_token"
  ON landlord_properties
  FOR SELECT
  TO anon
  USING (
    application_token IS NOT NULL
    AND application_token = current_setting('request.headers', true)::json->>'x-application-token'
  );

-- 4. RLS: allow anonymous reads on landlord_properties using concierge_token
CREATE POLICY IF NOT EXISTS "anon_read_by_concierge_token"
  ON landlord_properties
  FOR SELECT
  TO anon
  USING (
    concierge_token IS NOT NULL
    AND concierge_token = current_setting('request.headers', true)::json->>'x-concierge-token'
  );

-- 5. Add index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_landlord_properties_application_token
  ON landlord_properties(application_token);

CREATE INDEX IF NOT EXISTS idx_landlord_properties_concierge_token
  ON landlord_properties(concierge_token);

CREATE INDEX IF NOT EXISTS idx_applicants_schedule_token
  ON applicants(schedule_token);

-- 6. Update cron job: add sms-reminder alongside whatsapp-reminder
-- (whatsapp-reminder stays for now; sms-reminder is the new one)
SELECT cron.schedule(
  'sms-reminder',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := (SELECT 'https://' || current_setting('app.supabase_url') || '/functions/v1/sms-reminder'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
