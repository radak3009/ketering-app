CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- Remove existing job if rerunning
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-receipts-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-old-receipts-daily',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qqrvezuesxaappslfvrh.supabase.co/functions/v1/cleanup-old-receipts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcnZlenVlc3hhYXBwc2xmdnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNDM1NTksImV4cCI6MjA3NDcxOTU1OX0.0801HLIkQnUCbPpuFvoXhFb7BLgVsO_hjWcg7Pc6M0s","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcnZlenVlc3hhYXBwc2xmdnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNDM1NTksImV4cCI6MjA3NDcxOTU1OX0.0801HLIkQnUCbPpuFvoXhFb7BLgVsO_hjWcg7Pc6M0s"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);