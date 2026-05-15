-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule whatsapp-reminder to run every 15 minutes
SELECT cron.schedule(
  'whatsapp-reminder',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/whatsapp-reminder',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
                 'Content-Type',  'application/json'
               ),
    body    := '{}'::jsonb
  );
  $$
);
