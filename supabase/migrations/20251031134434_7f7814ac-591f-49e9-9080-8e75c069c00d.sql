-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule employee reminders
-- Wednesdays at 12:00 (noon)
SELECT cron.schedule(
  'send-employee-reminder-wednesday',
  '0 12 * * 3',
  $$
  SELECT
    net.http_post(
      url:='https://qqrvezuesxaappslfvrh.supabase.co/functions/v1/send-employee-reminder',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcnZlenVlc3hhYXBwc2xmdnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNDM1NTksImV4cCI6MjA3NDcxOTU1OX0.0801HLIkQnUCbPpuFvoXhFb7BLgVsO_hjWcg7Pc6M0s"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Fridays at 12:00 (noon) 
SELECT cron.schedule(
  'send-employee-reminder-friday',
  '0 12 * * 5',
  $$
  SELECT
    net.http_post(
      url:='https://qqrvezuesxaappslfvrh.supabase.co/functions/v1/send-employee-reminder',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcnZlenVlc3hhYXBwc2xmdnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNDM1NTksImV4cCI6MjA3NDcxOTU1OX0.0801HLIkQnUCbPpuFvoXhFb7BLgVsO_hjWcg7Pc6M0s"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Schedule admin menu alerts
-- Thursdays at 09:00 (morning)
SELECT cron.schedule(
  'send-admin-menu-alert-thursday',
  '0 9 * * 4',
  $$
  SELECT
    net.http_post(
      url:='https://qqrvezuesxaappslfvrh.supabase.co/functions/v1/send-admin-menu-alert',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcnZlenVlc3hhYXBwc2xmdnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNDM1NTksImV4cCI6MjA3NDcxOTU1OX0.0801HLIkQnUCbPpuFvoXhFb7BLgVsO_hjWcg7Pc6M0s"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);