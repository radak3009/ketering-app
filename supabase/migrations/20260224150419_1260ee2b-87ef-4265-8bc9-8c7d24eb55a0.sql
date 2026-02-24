
SELECT
  cron.schedule(
    'retry-failed-fiscalizations',
    '*/15 * * * *',
    $$
    SELECT
      net.http_post(
        url:='https://qqrvezuesxaappslfvrh.supabase.co/functions/v1/retry-failed-fiscalizations',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxcnZlenVlc3hhYXBwc2xmdnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNDM1NTksImV4cCI6MjA3NDcxOTU1OX0.0801HLIkQnUCbPpuFvoXhFb7BLgVsO_hjWcg7Pc6M0s"}'::jsonb,
        body:='{"source": "cron"}'::jsonb
      ) AS request_id;
    $$
  );
