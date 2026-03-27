UPDATE pickup_requests
SET fiscalized_at = fiscalized_at - interval '1 hour'
WHERE fiscalized_at IS NOT NULL
  AND fiscal_status = 'fiscalized';